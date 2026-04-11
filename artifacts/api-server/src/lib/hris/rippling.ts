import type { HrisAdapter, HrisEmployee } from "./types";

export class RipplingAdapter implements HrisAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_credentials: Record<string, unknown>) {}

  async testConnection(): Promise<void> {
    throw new Error("Rippling integration is not yet implemented.");
  }

  async syncEmployees(): Promise<HrisEmployee[]> {
    throw new Error("Rippling integration is not yet implemented.");
  }
}
