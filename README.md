# Portfolio.Ai

Local development setup for UI + server with OAuth sign-in.

## Quick start

1. Copy `.env.example` to `.env`.
2. Fill OAuth values:
   - `JWT_SECRET`
   - For Google sign-in (recommended local flow):
     - `VITE_GOOGLE_CLIENT_ID`
     - `GOOGLE_OAUTH_CLIENT_ID`
     - `GOOGLE_OAUTH_CLIENT_SECRET`
   - For legacy/custom OAuth portal flow:
     - `VITE_APP_ID`
     - `VITE_OAUTH_PORTAL_URL`
     - `OAUTH_SERVER_URL`
3. Install deps: `corepack pnpm install`
4. Start app: `corepack pnpm run dev`
5. Open: `http://localhost:3000`

## OAuth flow used by this app

- Frontend builds login URL in `client/src/const.ts` as:
  - Google mode: `https://accounts.google.com/o/oauth2/v2/auth?...`
  - Fallback mode: `${VITE_OAUTH_PORTAL_URL}/app-auth?appId=...&redirectUri=...&state=...&type=signIn`
- Redirect URI is fixed to:
  - `http://localhost:3000/api/oauth/callback` (or current origin in browser)
- Backend callback handler:
  - `server/_core/oauth.ts`
- OAuth token + userinfo exchange client:
  - Google mode: Google token + userinfo endpoints directly from `server/_core/oauth.ts`
  - Fallback mode: `server/_core/sdk.ts` using `OAUTH_SERVER_URL`

## Google Cloud Console settings (Web application)

- Authorized JavaScript origins:
  - `http://localhost:3000`
- Authorized redirect URIs:
  - `http://localhost:3000/api/oauth/callback`

## Troubleshooting Google sign-in

- Error `401: invalid_client` means Google does not recognize the `client_id` sent by the app.
- Verify `VITE_GOOGLE_CLIENT_ID` exactly matches the OAuth **Client ID** from Google Cloud (must end with `.apps.googleusercontent.com`).
- Do **not** put `GOCSPX-...` into `VITE_GOOGLE_CLIENT_ID`; that value is the **client secret** and belongs only in `GOOGLE_OAUTH_CLIENT_SECRET`.
- After updating `.env`, fully restart the dev server.

## Notes

- If `DATABASE_URL` is missing, sign-in still works but user upsert is skipped with a warning.
- If analytics env vars are missing, you'll see warnings from `%VITE_ANALYTICS_ENDPOINT%` placeholders.
