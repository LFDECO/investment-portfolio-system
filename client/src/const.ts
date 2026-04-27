export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  if (googleClientId) {
    if (googleClientId.startsWith("GOCSPX-")) {
      console.error(
        "[Auth] VITE_GOOGLE_CLIENT_ID looks like a client secret (GOCSPX-...). Use the Google OAuth Client ID ending with .apps.googleusercontent.com."
      );
      return null;
    }

    if (!googleClientId.endsWith(".apps.googleusercontent.com")) {
      console.error(
        "[Auth] VITE_GOOGLE_CLIENT_ID is not a valid Google Web Client ID. Expected value ending with .apps.googleusercontent.com."
      );
      return null;
    }

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", googleClientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("state", state);
    googleAuthUrl.searchParams.set("prompt", "consent");
    googleAuthUrl.searchParams.set("access_type", "offline");

    return googleAuthUrl.toString();
  }

  if (!oauthPortalUrl) {
    console.error(
      "[Auth] Missing VITE_OAUTH_PORTAL_URL (or VITE_GOOGLE_CLIENT_ID). Cannot build login URL."
    );
    return null;
  }

  if (!appId) {
    console.error("[Auth] Missing VITE_APP_ID. Cannot build login URL.");
    return null;
  }

  let url: URL;
  try {
    url = new URL("/app-auth", oauthPortalUrl);
  } catch {
    console.error(
      "[Auth] Invalid VITE_OAUTH_PORTAL_URL. Cannot build login URL.",
      oauthPortalUrl
    );
    return null;
  }

  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
