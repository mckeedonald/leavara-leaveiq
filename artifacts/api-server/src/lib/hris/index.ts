import { decrypt } from "../crypto";
import { BambooHrAdapter } from "./bamboohr";
import { WorkdayAdapter } from "./workday";
import { AdpAdapter } from "./adp";
import { RipplingAdapter } from "./rippling";
import type { HrisAdapter, HrisProvider } from "./types";

export function getAdapter(provider: HrisProvider, encryptedCredentials: string): HrisAdapter {
  const raw = decrypt(encryptedCredentials);
  const credentials = JSON.parse(raw) as Record<string, unknown>;

  switch (provider) {
    case "bamboohr":
      return new BambooHrAdapter(credentials as { subdomain: string; apiKey: string });
    case "workday":
      return new WorkdayAdapter(credentials);
    case "adp":
      return new AdpAdapter(credentials);
    case "rippling":
      return new RipplingAdapter(credentials);
    default:
      throw new Error(`Unknown HRIS provider: ${provider}`);
  }
}

export * from "./types";
