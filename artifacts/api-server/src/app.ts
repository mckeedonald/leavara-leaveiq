import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import cron from "node-cron";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { refreshRegulatoryDocs } from "./lib/regulatoryFetcher";
import { generalLimiter } from "./lib/rateLimiters";

const app: Express = express();

const isDev = process.env.NODE_ENV === "development";

// --- Security headers ---
app.use(
  helmet({
    contentSecurityPolicy: isDev
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'", "*.leavara.net"],
            frameAncestors: ["'none'"],
          },
        },
    crossOriginEmbedderPolicy: false,
    hsts: isDev ? false : { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
);

// --- CORS ---
const ALLOWED_ORIGINS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/leavara\.net$/,
  /^https?:\/\/[a-z0-9-]+\.leavara\.net$/,
  /\.replit\.dev$/,
  /\.picard\.replit\.dev$/,
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.some((r) => r.test(origin))) {
        callback(null, true);
      } else {
        logger.warn({ origin }, "CORS blocked request from disallowed origin");
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// --- Regulatory docs seed + cron ---
refreshRegulatoryDocs().catch((err) => logger.error({ err }, "Initial regulatory seed failed"));

cron.schedule("0 3 * * *", () => {
  logger.info("Scheduled regulatory refresh starting");
  refreshRegulatoryDocs().catch((err) => logger.error({ err }, "Scheduled regulatory refresh failed"));
});

// --- Request logging ---
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// General rate limit + routes
app.use("/api", generalLimiter);
app.use("/api", router);

// CORS error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message === "Not allowed by CORS") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

// Serve frontend in production
if (!isDev) {
  const frontendDist = path.resolve(
    process.cwd(),
    process.env["FRONTEND_DIST_PATH"] ?? "artifacts/leaveiq/dist/public",
  );
  app.use(express.static(frontendDist));
  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
