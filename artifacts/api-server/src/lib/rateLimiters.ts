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

// Tight limiter for the public employee lookup endpoint — prevents ID enumeration
export const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 15,              // 15 lookups per IP — plenty for a real employee, impractical for scrapers
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many lookup requests — please wait a moment and try again." },
  skip: () => isDev,
});
