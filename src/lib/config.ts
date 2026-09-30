function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `MISSING REQUIRED ENVIRONMENT VARIABLE: ${name}\n` +
      `The application cannot start without this variable.\n` +
      `Set it in your .env file or environment before starting the server.`
    );
  }
  return value;
}

export const config = {
  auth: {
    jwtSecret: requireEnv("JWT_SECRET"),
    jwtAlgorithm: process.env.JWT_ALGORITHM || "HS256",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    jwtCookieMaxAge: Number(process.env.JWT_COOKIE_MAX_AGE) || 604800,
    tokenRefreshThresholdMs: Number(process.env.TOKEN_REFRESH_THRESHOLD_MS) || 259200000,
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  },
  rateLimit: {
    register: { limit: Number(process.env.RATE_LIMIT_REGISTER) || 3, windowMs: 60000 },
    login: { limit: Number(process.env.RATE_LIMIT_LOGIN) || 5, windowMs: 60000 },
    proofread: { limit: Number(process.env.RATE_LIMIT_PROOFREAD) || 20, windowMs: 60000 },
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 30000,
  },
  app: {
    contentMaxLength: Number(process.env.CONTENT_MAX_LENGTH) || 50000,
    titleMaxLength: Number(process.env.TITLE_MAX_LENGTH) || 200,
    passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH) || 8,
    passwordMaxLength: Number(process.env.PASSWORD_MAX_LENGTH) || 128,
    autosaveDebounceMs: Number(process.env.AUTOSAVE_DEBOUNCE_MS) || 1500,
    notificationTimeoutMs: Number(process.env.NOTIFICATION_TIMEOUT_MS) || 3000,
    gradeLevels: JSON.parse(
      process.env.GRADE_LEVELS ||
        '[{"minScore":90,"label":"5th Grade (Very Easy)"},{"minScore":80,"label":"6th Grade (Easy)"},{"minScore":70,"label":"7th Grade (Fairly Easy)"},{"minScore":60,"label":"8th-9th Grade (Standard)"},{"minScore":50,"label":"10th-12th Grade (Fairly Difficult)"},{"minScore":30,"label":"College (Difficult)"},{"minScore":0,"label":"College Graduate (Very Confusing)"}]'
    ) as Array<{ minScore: number; label: string }>,
  },
};
