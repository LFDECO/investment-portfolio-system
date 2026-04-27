const getEnv = (key: string) => process.env[key]?.trim() ?? "";

export const ENV = {
  appId: getEnv("VITE_APP_ID") || getEnv("GOOGLE_OAUTH_CLIENT_ID"),
  cookieSecret: getEnv("JWT_SECRET"),
  databaseUrl: getEnv("DATABASE_URL"),
  oAuthServerUrl: getEnv("OAUTH_SERVER_URL"),
  googleOAuthClientId: getEnv("GOOGLE_OAUTH_CLIENT_ID"),
  googleOAuthClientSecret: getEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
  ownerOpenId: getEnv("OWNER_OPEN_ID"),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: getEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: getEnv("BUILT_IN_FORGE_API_KEY"),
};
