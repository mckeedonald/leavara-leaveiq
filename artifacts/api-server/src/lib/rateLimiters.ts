import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV === "development";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts — please try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { error: "Too many AI requests — please wait a moment before trying again" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: "Too many requests — please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});
