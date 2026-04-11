import { logger } from "../logger";
import type { HrisAdapter, HrisEmployee, BambooHrCredentials } from "./types";

export class BambooHrAdapter implements HrisAdapter {
  private subdomain: string;
  private apiKey: string;

  constructor(credentials: BambooHrCredentials) {
    this.subdomain = credentials.subdomain;
    this.apiKey = credentials.apiKey;
  }

  private baseUrl(): string {
    return `https://api.bamboohr.com/api/gateway.php/${this.subdomain}/v1`;
  }

  private authHeader(): string {
    return "Basic " + Buffer.from(`${this.apiKey}:x`).toString("base64");
  }

  async testConnection(): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/employees/directory`, {
      headers: {
        Authorization: this.authHeader(),
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, "BambooHR connection test failed");
      throw new Error(`BambooHR connection failed (${res.status}): ${body}`);
    }
  }

  async syncEmployees(): Promise<HrisEmployee[]> {
    const res = await fetch(
      `${this.baseUrl()}/employees/directory`,
      {
        headers: {
          Authorization: this.authHeader(),
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`BambooHR directory fetch failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      employees: Array<{
        id: string;
        displayName: string;
        firstName: string;
        lastName: string;
        workEmail?: string;
        homeEmail?: string;
        hireDate?: string;
        location?: string;
        department?: string;
        jobTitle?: string;
      }>;
    };

    const employees: HrisEmployee[] = [];

    for (const emp of data.employees ?? []) {
      // Fetch additional fields (hours) for each employee
      let avgHoursPerWeek: number | null = null;
      try {
        const detailRes = await fetch(
          `${this.baseUrl()}/employees/${emp.id}?fields=averageHoursPerWeek,hireDate,homeEmail`,
          {
            headers: {
              Authorization: this.authHeader(),
              Accept: "application/json",
            },
          },
        );
        if (detailRes.ok) {
          const detail = (await detailRes.json()) as {
            averageHoursPerWeek?: string;
            hireDate?: string;
            homeEmail?: string;
          };
          if (detail.averageHoursPerWeek) {
            avgHoursPerWeek = parseFloat(detail.averageHoursPerWeek);
          }
          if (detail.homeEmail && !emp.homeEmail) {
            emp.homeEmail = detail.homeEmail;
          }
          if (detail.hireDate && !emp.hireDate) {
            emp.hireDate = detail.hireDate;
          }
        }
      } catch (err) {
        logger.warn({ employeeId: emp.id, err }, "BambooHR detail fetch failed — using partial data");
      }

      employees.push({
        externalId: emp.id,
        fullName: emp.displayName ?? `${emp.firstName} ${emp.lastName}`.trim(),
        personalEmail: emp.homeEmail ?? null,
        hireDate: emp.hireDate ?? null,
        avgHoursPerWeek,
        rawData: emp as Record<string, unknown>,
      });
    }

    return employees;
  }
}
