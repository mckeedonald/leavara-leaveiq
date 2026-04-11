import type { HrisAdapter, HrisEmployee } from "./types";

export class AdpAdapter implements HrisAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_credentials: Record<string, unknown>) {}

  async testConnection(): Promise<void> {
    throw new Error("ADP integration is not yet implemented.");
  }

  async syncEmployees(): Promise<HrisEmployee[]> {
    throw new Error("ADP integration is not yet implemented.");
  }
}
