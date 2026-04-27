import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import axios from "axios";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { ensureSchemaUserByEmail } from "./schemaUser";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

type GoogleTokenResponse = {
  access_token: string;
};

type GoogleUserInfoResponse = {
  sub: string;
  name?: string;
  email?: string;
};

function decodeRedirectUriFromState(state: string): string | null {
  try {
    const value = Buffer.from(state, "base64").toString("utf-8");
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

async function exchangeGoogleCodeForToken(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  if (!ENV.googleOAuthClientId || !ENV.googleOAuthClientSecret) {
    throw new Error("Google OAuth client credentials are not configured");
  }

  const params = new URLSearchParams({
    code,
    client_id: ENV.googleOAuthClientId,
    client_secret: ENV.googleOAuthClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const { data } = await axios.post<GoogleTokenResponse>(
    "https://oauth2.googleapis.com/token",
    params.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return data;
}

async function getGoogleUserInfo(accessToken: string) {
  const { data } = await axios.get<GoogleUserInfoResponse>(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return data;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const redirectUri = decodeRedirectUriFromState(state);
      if (!redirectUri) {
        res.status(400).json({ error: "invalid state" });
        return;
      }

      let openId: string | null = null;
      let name: string | null = null;
      let email: string | null = null;
      let loginMethod: string | null = null;

      const isGoogleDirectMode = Boolean(
        ENV.googleOAuthClientId && ENV.googleOAuthClientSecret
      );

      if (isGoogleDirectMode) {
        const token = await exchangeGoogleCodeForToken(code, redirectUri);
        const userInfo = await getGoogleUserInfo(token.access_token);

        openId = userInfo.sub ?? null;
        name = userInfo.name ?? null;
        email = userInfo.email ?? null;
        loginMethod = "google";
      } else {
        const tokenResponse = await sdk.exchangeCodeForToken(code, state);
        const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

        openId = userInfo.openId ?? null;
        name = userInfo.name || null;
        email = userInfo.email ?? null;
        loginMethod = userInfo.loginMethod ?? userInfo.platform ?? null;
      }

      if (!openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      if (isGoogleDirectMode) {
        if (!email) {
          res.status(400).json({ error: "email missing from Google user info" });
          return;
        }

        await ensureSchemaUserByEmail({
          email,
          name: name || email,
        });
      } else {
        await db.upsertUser({
          openId,
          name,
          email,
          loginMethod,
          lastSignedIn: new Date(),
        });
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || "",
        email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, `/dashboard?authToken=${encodeURIComponent(sessionToken)}`);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
