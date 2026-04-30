import app from "./app";
import { logger } from "./lib/logger";
import cron from "node-cron";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Daily leave law knowledge scrape — runs at 2:00 AM server time
  cron.schedule("0 2 * * *", async () => {
    logger.info("Starting daily leave law knowledge scrape");
    try {
      const { runDailyScrape } = await import("./lib/leaveKnowledgeScraper.js");
      const result = await runDailyScrape();
      logger.info({ result }, "Daily leave law scrape completed");
    } catch (err) {
      logger.error({ err }, "Daily leave law scrape failed");
    }
  });
});
