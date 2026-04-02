import { ingestDocument } from "./rag";
import { logger } from "./logger";

const ECFR_BASE = "https://www.ecfr.gov/api/versioner/v1";

async function fetchEcfrSection(title: number, part: number): Promise<string | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `${ECFR_BASE}/full/${today}/title-${title}/chapter-V/subchapter-B/part-${part}.json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "eCFR fetch non-200");
      return null;
    }
    const json = await res.json() as Record<string, unknown>;
    return extractEcfrText(json);
  } catch (err) {
    logger.error({ err, title, part }, "Failed to fetch eCFR section");
    return null;
  }
}

function extractEcfrText(node: unknown, depth = 0): string {
  if (!node || typeof node !== "object") return "";
  const obj = node as Record<string, unknown>;

  const parts: string[] = [];

  if (typeof obj["heading"] === "string" && obj["heading"]) {
    parts.push(obj["heading"]);
  }
  if (typeof obj["title"] === "string" && obj["title"]) {
    parts.push(obj["title"]);
  }
  if (typeof obj["subject"] === "string" && obj["subject"]) {
    parts.push(obj["subject"]);
  }
  if (typeof obj["text"] === "string" && obj["text"].trim()) {
    parts.push(obj["text"].trim());
  }
  if (Array.isArray(obj["children"])) {
    for (const child of obj["children"] as unknown[]) {
      parts.push(extractEcfrText(child, depth + 1));
    }
  }
  if (Array.isArray(obj["content"])) {
    for (const child of obj["content"] as unknown[]) {
      parts.push(extractEcfrText(child, depth + 1));
    }
  }

  return parts.filter(Boolean).join("\n");
}

const CA_CFRA_TEXT = `
CALIFORNIA FAMILY RIGHTS ACT (CFRA) — Government Code § 12945.2 Key Provisions

COVERAGE: Employers with 5 or more employees (effective January 1, 2021, per SB 1383).

EMPLOYEE ELIGIBILITY:
- Employed for at least 12 months by the employer
- Worked at least 1,250 hours in the 12-month period before leave
- Works at a worksite where the employer has 5 or more employees within 75 miles

ENTITLEMENT:
- Up to 12 workweeks of unpaid, job-protected leave per calendar year
- Leave may be taken for: employee's own serious health condition; care for a spouse, child, parent, grandparent, grandchild, sibling, or domestic partner with a serious health condition; bonding with a new child (birth, adoption, foster care); qualifying military exigency

BABY BONDING:
- 12 weeks for bonding with a new child within 12 months of birth, adoption, or foster placement
- Available to both parents (if both work for same employer, each entitled to 12 weeks)
- Does not run concurrently with PDL unless employer designates

SERIOUS HEALTH CONDITION: Illness, injury, impairment, or physical or mental condition involving inpatient care or continuing treatment by a healthcare provider.

INTERACTION WITH FMLA:
- CFRA and FMLA run concurrently for qualifying conditions (except pregnancy disability, which only triggers PDL/FMLA, not CFRA)
- After PDL exhausted, employee may take up to 12 weeks CFRA for baby bonding

CFRA PREGNANCY EXCEPTION: Pregnancy disability is covered by PDL, not CFRA. CFRA baby bonding leave is a separate, additional 12-week entitlement.

NOTICE REQUIREMENTS: Employer must provide notice of rights and designate leave within 5 business days.

PAY DURING LEAVE: CFRA leave is unpaid; employee may receive California Paid Family Leave (PFL) wage replacement benefits through EDD.
`.trim();

const CA_PDL_TEXT = `
CALIFORNIA PREGNANCY DISABILITY LEAVE (PDL) — Government Code § 12945 Key Provisions

COVERAGE: Employers with 5 or more employees (full-time, part-time, temporary).

EMPLOYEE ELIGIBILITY: All employees who are disabled by pregnancy, childbirth, or a related medical condition — no minimum tenure or hours-worked requirement.

ENTITLEMENT:
- Up to 4 months (17⅓ weeks) of disability leave per pregnancy
- Leave may be taken intermittently or on a reduced schedule as medically necessary
- Includes time for prenatal care, severe morning sickness, gestational diabetes, preeclampsia, recovery from childbirth, postpartum depression, and other pregnancy-related conditions

CERTIFICATION: Employer may require healthcare provider certification of disability.

JOB PROTECTION: Employee entitled to same or comparable position upon return.

INTERACTION WITH FMLA: PDL runs concurrently with FMLA (12 weeks maximum FMLA leave). After PDL, employee may take CFRA baby bonding leave if otherwise eligible.

INTERACTION WITH CFRA: PDL and CFRA do not run concurrently. An employee may take up to 4 months PDL followed by 12 weeks CFRA bonding leave.

TRANSFER RIGHTS: Employer may transfer employee to an alternative position with equivalent pay during intermittent or reduced-schedule PDL.

PAY DURING LEAVE: PDL is unpaid; employee may receive California State Disability Insurance (SDI) benefits through EDD.

SB 1383 (effective Jan 1, 2021): Expanded CFRA to small employers; did not change PDL eligibility threshold.
`.trim();

const CA_PFL_TEXT = `
CALIFORNIA PAID FAMILY LEAVE (PFL) — Unemployment Insurance Code § 3300 et seq.

ADMINISTERED BY: California Employment Development Department (EDD)

COVERAGE: All California workers who pay into SDI (State Disability Insurance); no employer-size threshold.

BENEFIT:
- Up to 8 weeks of partial wage replacement (approximately 60–70% of weekly wages, up to state maximum)
- Available for bonding with a new child, caring for a seriously ill family member, or qualifying military assist

INTERACTION WITH EMPLOYER LEAVE:
- PFL does not provide job protection — it must be taken concurrently with CFRA or FMLA to have job protection
- Employers may require employees to use up to 2 weeks accrued vacation before PFL benefits begin for bonding leave

FAMILY MEMBER DEFINITION: Spouse, child, parent, grandparent, grandchild, sibling, domestic partner, parent-in-law.
`.trim();

export const REGULATORY_SOURCES = [
  { name: "FMLA — 29 CFR Part 825", fetchFn: () => fetchEcfrSection(29, 825), type: "FEDERAL_FMLA" },
];

export const STATIC_REGULATORY_DOCS = [
  { name: "California CFRA — Key Provisions", text: CA_CFRA_TEXT, type: "CA_CFRA" },
  { name: "California PDL — Key Provisions", text: CA_PDL_TEXT, type: "CA_PDL" },
  { name: "California PFL — Key Provisions", text: CA_PFL_TEXT, type: "CA_PFL" },
];

export async function refreshRegulatoryDocs(): Promise<void> {
  logger.info("Starting regulatory document refresh");

  for (const source of STATIC_REGULATORY_DOCS) {
    try {
      await ingestDocument({
        name: source.name,
        sourceType: source.type,
        fullText: source.text,
        organizationId: null,
      });
      logger.info({ name: source.name }, "Static regulatory doc ingested");
    } catch (err) {
      logger.error({ err, name: source.name }, "Failed to ingest static regulatory doc");
    }
  }

  for (const source of REGULATORY_SOURCES) {
    try {
      const text = await source.fetchFn();
      if (!text || text.trim().length < 100) {
        logger.warn({ name: source.name }, "Regulatory fetch returned empty or short text — skipping");
        continue;
      }
      await ingestDocument({
        name: source.name,
        sourceType: source.type,
        fullText: text,
        organizationId: null,
      });
      logger.info({ name: source.name }, "Regulatory doc refreshed from eCFR");
    } catch (err) {
      logger.error({ err, name: source.name }, "Failed to refresh regulatory doc");
    }
  }

  logger.info("Regulatory document refresh complete");
}
