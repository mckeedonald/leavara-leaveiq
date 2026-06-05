/**
 * Scheduled retention runner.
 *
 * Intended to be invoked on a schedule (e.g. a daily Railway cron job) via:
 *   pnpm --filter @workspace/api-server run-retention
 *
 * Applies each org's configured retention windows. Orgs without an enabled
 * retention_policy row are skipped entirely (fail-safe — nothing is deleted
 * until an admin explicitly configures and enables a policy).
 */
import { runRetention } from "../lib/retention";
import { logger } from "../lib/logger";

try {
  const summaries = await runRetention();
  if (summaries.length === 0) {
    logger.info("Retention runner: no orgs have an enabled retention policy — nothing to do.");
  } else {
    logger.info({ orgs: summaries.length, summaries }, "Retention runner: complete.");
  }
  process.exit(0);
} catch (err) {
  logger.error({ err }, "Retention runner: failed");
  process.exit(1);
}
