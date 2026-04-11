export interface HrisEmployee {
  externalId: string;
  fullName: string;
  personalEmail: string | null;
  hireDate: string | null; // ISO date string "YYYY-MM-DD"
  avgHoursPerWeek: number | null;
  rawData: Record<string, unknown>;
}

export interface HrisAdapter {
  /** Verify credentials are valid — throws on failure */
  testConnection(): Promise<void>;
  /** Pull all active employees and return normalized records */
  syncEmployees(): Promise<HrisEmployee[]>;
}

export type HrisProvider = "bamboohr" | "workday" | "adp" | "rippling";

export interface BambooHrCredentials {
  subdomain: string;
  apiKey: string;
}
