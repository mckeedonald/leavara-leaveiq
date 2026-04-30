/**
 * US Leave Law Knowledge Scraper
 *
 * Scrapes official government sources for all 50 states + federal leave laws.
 * Runs daily via cron. Detects content changes by SHA-256 hash comparison.
 * Flags failed or changed sources for system admin review.
 * Stores content into the shared RAG (organizationId = null → available to all orgs).
 */

import crypto from "node:crypto";
import { db, leaveKnowledgeSourcesTable, ragDocumentsTable, ragChunksTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { ingestDocument } from "./rag.js";
import { logger } from "./logger.js";

const FETCH_TIMEOUT_MS = 15000;

interface LeaveSource {
  key: string;
  jurisdiction: string;
  lawName: string;
  url: string;
  type: "dol" | "state_labor" | "eeoc" | "other";
  /** Optional: secondary URLs to supplement this source */
  supplementUrls?: string[];
}

/** Complete list of all US leave law sources — federal + all 50 states + DC */
export const ALL_LEAVE_SOURCES: LeaveSource[] = [
  // ── Federal ────────────────────────────────────────────────────────────────
  { key: "federal_fmla",          jurisdiction: "federal", lawName: "Family and Medical Leave Act (FMLA)",                  url: "https://www.dol.gov/agencies/whd/fmla",               type: "dol", supplementUrls: ["https://www.dol.gov/agencies/whd/fmla/employees"] },
  { key: "federal_ada",           jurisdiction: "federal", lawName: "Americans with Disabilities Act (ADA)",                url: "https://www.eeoc.gov/disability-discrimination",       type: "eeoc", supplementUrls: ["https://www.eeoc.gov/laws/guidance/enforcement-guidance-reasonable-accommodation-and-undue-hardship-under-ada"] },
  { key: "federal_pdl",           jurisdiction: "federal", lawName: "Pregnancy Discrimination Act (PDA)",                   url: "https://www.eeoc.gov/pregnancy-discrimination",       type: "eeoc" },
  { key: "federal_pump_act",      jurisdiction: "federal", lawName: "PUMP for Nursing Mothers Act",                         url: "https://www.dol.gov/agencies/whd/pump-act",           type: "dol" },
  { key: "federal_userra",        jurisdiction: "federal", lawName: "Uniformed Services Employment and Reemployment Rights Act (USERRA)", url: "https://www.dol.gov/agencies/vets/programs/userra", type: "dol" },
  { key: "federal_cobra",         jurisdiction: "federal", lawName: "COBRA Benefits Continuation",                          url: "https://www.dol.gov/general/topic/health-plans/cobra", type: "dol" },

  // ── Alabama ──────────────────────────────────────────────────────────────
  { key: "al_leave",              jurisdiction: "AL", lawName: "Alabama Leave Laws",                                        url: "https://labor.alabama.gov/docs/guides/LS_LeaveGuide.pdf", type: "state_labor" },

  // ── Alaska ───────────────────────────────────────────────────────────────
  { key: "ak_parental_leave",     jurisdiction: "AK", lawName: "Alaska Family Leave Act (AFLA) & Parental Leave",          url: "https://labor.alaska.gov/lss/aml.htm",                type: "state_labor" },

  // ── Arizona ──────────────────────────────────────────────────────────────
  { key: "az_esa",                jurisdiction: "AZ", lawName: "Arizona Earned Paid Sick Time (Proposition 206)",          url: "https://www.azica.gov/divisions/labor-department/arizona-earned-paid-sick-time", type: "state_labor" },

  // ── Arkansas ─────────────────────────────────────────────────────────────
  { key: "ar_leave",              jurisdiction: "AR", lawName: "Arkansas Leave Laws",                                       url: "https://www.labor.ar.gov/",                           type: "state_labor" },

  // ── California ───────────────────────────────────────────────────────────
  { key: "ca_cfra",               jurisdiction: "CA", lawName: "California Family Rights Act (CFRA)",                      url: "https://calcivilrights.ca.gov/family-medical-leave/", type: "state_labor" },
  { key: "ca_pfl",                jurisdiction: "CA", lawName: "California Paid Family Leave (PFL)",                       url: "https://www.edd.ca.gov/Disability/Paid_Family_Leave.htm", type: "state_labor" },
  { key: "ca_pdl",                jurisdiction: "CA", lawName: "California Pregnancy Disability Leave (PDL)",              url: "https://calcivilrights.ca.gov/pregnancy-disability/", type: "state_labor" },
  { key: "ca_pto_sick",           jurisdiction: "CA", lawName: "California Sick Leave Law (SB 616)",                       url: "https://www.dir.ca.gov/dlse/paid_sick_leave.htm",     type: "state_labor" },
  { key: "ca_bereavement",        jurisdiction: "CA", lawName: "California Bereavement Leave (AB 1949)",                   url: "https://www.dir.ca.gov/dlse/bereavement-leave.html",  type: "state_labor" },
  { key: "ca_reproductive_loss",  jurisdiction: "CA", lawName: "California Reproductive Loss Leave (SB 848)",              url: "https://calcivilrights.ca.gov/reproductive-loss-leave/", type: "state_labor" },

  // ── Colorado ─────────────────────────────────────────────────────────────
  { key: "co_famli",              jurisdiction: "CO", lawName: "Colorado Family and Medical Leave Insurance (FAMLI)",       url: "https://famli.colorado.gov/",                         type: "state_labor" },
  { key: "co_hfwa",               jurisdiction: "CO", lawName: "Colorado Healthy Families & Workplaces Act (HFWA)",        url: "https://cdle.colorado.gov/hfwa",                      type: "state_labor" },

  // ── Connecticut ──────────────────────────────────────────────────────────
  { key: "ct_pfml",               jurisdiction: "CT", lawName: "Connecticut Paid Family and Medical Leave (CT PFML)",      url: "https://ctpaidleave.org/",                            type: "state_labor" },
  { key: "ct_fmla",               jurisdiction: "CT", lawName: "Connecticut Family & Medical Leave Act (CT FMLA)",         url: "https://portal.ct.gov/dol/divisions/wage-and-workplace-standards/family-medical-leave", type: "state_labor" },

  // ── Delaware ─────────────────────────────────────────────────────────────
  { key: "de_pfmla",              jurisdiction: "DE", lawName: "Delaware Paid Family and Medical Leave Act (PFMLA)",       url: "https://labor.delaware.gov/divisions/industrial-affairs/paid-leave/", type: "state_labor" },

  // ── District of Columbia ─────────────────────────────────────────────────
  { key: "dc_pfml",               jurisdiction: "DC", lawName: "DC Paid Family Leave (PFL)",                               url: "https://does.dc.gov/service/dc-paid-family-leave",    type: "state_labor" },
  { key: "dc_cmpa",               jurisdiction: "DC", lawName: "DC Family and Medical Leave Act (DCFMLA)",                 url: "https://ohr.dc.gov/page/family-and-medical-leave-act", type: "state_labor" },

  // ── Florida ──────────────────────────────────────────────────────────────
  { key: "fl_leave",              jurisdiction: "FL", lawName: "Florida Leave Laws",                                       url: "https://floridajobs.org/docs/default-source/reemployment-assistance-center/employers/poster-package/right-to-work.pdf", type: "state_labor" },

  // ── Georgia ──────────────────────────────────────────────────────────────
  { key: "ga_leave",              jurisdiction: "GA", lawName: "Georgia Leave Laws",                                       url: "https://dol.georgia.gov/",                            type: "state_labor" },

  // ── Hawaii ───────────────────────────────────────────────────────────────
  { key: "hi_tdi",                jurisdiction: "HI", lawName: "Hawaii Temporary Disability Insurance (TDI)",              url: "https://labor.hawaii.gov/dcd/tdi/",                   type: "state_labor" },
  { key: "hi_family_leave",       jurisdiction: "HI", lawName: "Hawaii Family Leave Law",                                  url: "https://labor.hawaii.gov/dcd/family-leave/",          type: "state_labor" },

  // ── Idaho ─────────────────────────────────────────────────────────────────
  { key: "id_leave",              jurisdiction: "ID", lawName: "Idaho Leave Laws",                                         url: "https://labor.idaho.gov/",                            type: "state_labor" },

  // ── Illinois ─────────────────────────────────────────────────────────────
  { key: "il_vessa",              jurisdiction: "IL", lawName: "Illinois Victims' Economic Security and Safety Act (VESSA)", url: "https://labor.illinois.gov/content/dam/soi/en/web/idol/docs/VESSA.pdf", type: "state_labor" },
  { key: "il_child_bereavement",  jurisdiction: "IL", lawName: "Illinois Child Bereavement Leave Act",                    url: "https://labor.illinois.gov/content/dam/soi/en/web/idol/docs/child_bereavement_leave_act.pdf", type: "state_labor" },
  { key: "il_paid_leave",         jurisdiction: "IL", lawName: "Illinois Paid Leave for All Workers Act",                  url: "https://labor.illinois.gov/content/dam/soi/en/web/idol/docs/paid-leave-for-all-workers-act.pdf", type: "state_labor" },

  // ── Indiana ──────────────────────────────────────────────────────────────
  { key: "in_leave",              jurisdiction: "IN", lawName: "Indiana Leave Laws",                                       url: "https://www.in.gov/dol/",                             type: "state_labor" },

  // ── Iowa ──────────────────────────────────────────────────────────────────
  { key: "ia_leave",              jurisdiction: "IA", lawName: "Iowa Leave Laws",                                          url: "https://www.iwd.iowa.gov/",                           type: "state_labor" },

  // ── Kansas ────────────────────────────────────────────────────────────────
  { key: "ks_leave",              jurisdiction: "KS", lawName: "Kansas Leave Laws",                                        url: "https://www.dol.ks.gov/",                             type: "state_labor" },

  // ── Kentucky ─────────────────────────────────────────────────────────────
  { key: "ky_leave",              jurisdiction: "KY", lawName: "Kentucky Leave Laws",                                      url: "https://labor.ky.gov/",                               type: "state_labor" },

  // ── Louisiana ─────────────────────────────────────────────────────────────
  { key: "la_pregnancy_leave",    jurisdiction: "LA", lawName: "Louisiana Pregnancy Leave Law",                            url: "https://www.laworks.net/",                            type: "state_labor" },

  // ── Maine ─────────────────────────────────────────────────────────────────
  { key: "me_pfml",               jurisdiction: "ME", lawName: "Maine Paid Family and Medical Leave",                      url: "https://www.maine.gov/pfml/",                         type: "state_labor" },

  // ── Maryland ──────────────────────────────────────────────────────────────
  { key: "md_time_to_care",       jurisdiction: "MD", lawName: "Maryland Time to Care Act (Paid Family and Medical Leave)", url: "https://www.dllr.state.md.us/paidleave/",           type: "state_labor" },

  // ── Massachusetts ─────────────────────────────────────────────────────────
  { key: "ma_pfml",               jurisdiction: "MA", lawName: "Massachusetts Paid Family and Medical Leave (PFML)",       url: "https://www.mass.gov/paid-family-and-medical-leave",  type: "state_labor" },
  { key: "ma_earned_sick",        jurisdiction: "MA", lawName: "Massachusetts Earned Sick Time Law",                       url: "https://www.mass.gov/earned-sick-time",               type: "state_labor" },

  // ── Michigan ──────────────────────────────────────────────────────────────
  { key: "mi_pmla",               jurisdiction: "MI", lawName: "Michigan Paid Medical Leave Act",                          url: "https://www.michigan.gov/leo/bureaus-agencies/ors/dced/wage-hour-division/paid-medical-leave-act", type: "state_labor" },

  // ── Minnesota ─────────────────────────────────────────────────────────────
  { key: "mn_pfml",               jurisdiction: "MN", lawName: "Minnesota Paid Family and Medical Leave",                  url: "https://paidleave.mn.gov/",                           type: "state_labor" },
  { key: "mn_sick_safe",          jurisdiction: "MN", lawName: "Minnesota Earned Sick and Safe Time",                      url: "https://www.dli.mn.gov/business/employment-practices/sick-and-safe-time", type: "state_labor" },

  // ── Mississippi ───────────────────────────────────────────────────────────
  { key: "ms_leave",              jurisdiction: "MS", lawName: "Mississippi Leave Laws",                                   url: "https://mdes.ms.gov/",                                type: "state_labor" },

  // ── Missouri ──────────────────────────────────────────────────────────────
  { key: "mo_leave",              jurisdiction: "MO", lawName: "Missouri Leave Laws",                                      url: "https://labor.mo.gov/",                               type: "state_labor" },

  // ── Montana ───────────────────────────────────────────────────────────────
  { key: "mt_wrongful_discharge",  jurisdiction: "MT", lawName: "Montana Wrongful Discharge from Employment Act",           url: "https://erd.dli.mt.gov/labor-standards/leave-time",  type: "state_labor" },

  // ── Nebraska ──────────────────────────────────────────────────────────────
  { key: "ne_leave",              jurisdiction: "NE", lawName: "Nebraska Leave Laws",                                      url: "https://dol.nebraska.gov/",                           type: "state_labor" },

  // ── Nevada ────────────────────────────────────────────────────────────────
  { key: "nv_paid_leave",         jurisdiction: "NV", lawName: "Nevada Paid Leave Law (SB 312)",                           url: "https://labor.nv.gov/Policies_Forms_and_Publications/Paid_Leave/", type: "state_labor" },

  // ── New Hampshire ─────────────────────────────────────────────────────────
  { key: "nh_leave",              jurisdiction: "NH", lawName: "New Hampshire Leave Laws",                                 url: "https://www.labor.nh.gov/",                           type: "state_labor" },

  // ── New Jersey ────────────────────────────────────────────────────────────
  { key: "nj_fla",                jurisdiction: "NJ", lawName: "New Jersey Family Leave Act (NJFLA)",                      url: "https://www.nj.gov/labor/myworkerrights/leave/family_leave/",  type: "state_labor" },
  { key: "nj_fli",                jurisdiction: "NJ", lawName: "New Jersey Family Leave Insurance (FLI)",                  url: "https://www.nj.gov/labor/myworkerrights/leave/fli/",   type: "state_labor" },
  { key: "nj_tdi",                jurisdiction: "NJ", lawName: "New Jersey Temporary Disability Insurance (TDI)",          url: "https://www.nj.gov/labor/myworkerrights/leave/tdi/",   type: "state_labor" },
  { key: "nj_safe_act",           jurisdiction: "NJ", lawName: "New Jersey Security and Financial Empowerment Act (SAFE)", url: "https://www.nj.gov/labor/myworkerrights/leave/safe/",  type: "state_labor" },

  // ── New Mexico ────────────────────────────────────────────────────────────
  { key: "nm_healthy_workplaces", jurisdiction: "NM", lawName: "New Mexico Healthy Workplaces Act",                        url: "https://www.dws.state.nm.us/LinkClick.aspx?fileticket=YiIMkNJVE4s%3D&portalid=0", type: "state_labor" },

  // ── New York ──────────────────────────────────────────────────────────────
  { key: "ny_pfl",                jurisdiction: "NY", lawName: "New York Paid Family Leave (NY PFL)",                      url: "https://www.ny.gov/programs/new-york-paid-family-leave", type: "state_labor" },
  { key: "ny_dbf",                jurisdiction: "NY", lawName: "New York Disability Benefits Law (DBL)",                   url: "https://www.wcb.ny.gov/content/main/DisabilityBenefits/Employer/intro-DBL.jsp", type: "state_labor" },
  { key: "ny_sick_leave",         jurisdiction: "NY", lawName: "New York State Sick Leave Law",                            url: "https://www.labor.ny.gov/worker-protection/labor-standards/workprot/sickleave.shtm", type: "state_labor" },
  { key: "ny_safe_leave",         jurisdiction: "NY", lawName: "New York Safe Leave / Domestic Violence Leave",            url: "https://www.labor.ny.gov/worker-protection/labor-standards/domestic-violence-leave.shtm", type: "state_labor" },
  { key: "nyc_earned_sick",       jurisdiction: "NY", lawName: "New York City Earned Safe and Sick Time Act",              url: "https://www.nyc.gov/site/dca/businesses/paid-sick-leave-law-for-employers.page", type: "state_labor" },

  // ── North Carolina ────────────────────────────────────────────────────────
  { key: "nc_leave",              jurisdiction: "NC", lawName: "North Carolina Leave Laws",                                url: "https://www.labor.nc.gov/labor-law-questions/north-carolina-family-and-medical-leave", type: "state_labor" },

  // ── North Dakota ──────────────────────────────────────────────────────────
  { key: "nd_leave",              jurisdiction: "ND", lawName: "North Dakota Leave Laws",                                  url: "https://www.nd.gov/labor/",                           type: "state_labor" },

  // ── Ohio ──────────────────────────────────────────────────────────────────
  { key: "oh_leave",              jurisdiction: "OH", lawName: "Ohio Leave Laws",                                          url: "https://com.ohio.gov/divisions-and-programs/industrial-compliance/ohio-civil-rights-commission", type: "state_labor" },

  // ── Oklahoma ──────────────────────────────────────────────────────────────
  { key: "ok_leave",              jurisdiction: "OK", lawName: "Oklahoma Leave Laws",                                      url: "https://www.ok.gov/odol/",                            type: "state_labor" },

  // ── Oregon ────────────────────────────────────────────────────────────────
  { key: "or_pfmli",              jurisdiction: "OR", lawName: "Oregon Paid Leave (Paid Family and Medical Leave Insurance)", url: "https://paidleave.oregon.gov/",                   type: "state_labor" },
  { key: "or_ofla",               jurisdiction: "OR", lawName: "Oregon Family Leave Act (OFLA)",                           url: "https://www.oregon.gov/boli/workers/pages/oregon-family-leave.aspx", type: "state_labor" },
  { key: "or_sick_leave",         jurisdiction: "OR", lawName: "Oregon Sick Leave Law",                                    url: "https://www.oregon.gov/boli/workers/pages/sick-leave.aspx", type: "state_labor" },

  // ── Pennsylvania ──────────────────────────────────────────────────────────
  { key: "pa_leave",              jurisdiction: "PA", lawName: "Pennsylvania Leave Laws",                                  url: "https://www.dli.pa.gov/Individuals/Labor-Management-Relations/llc/Pages/leave-law.aspx", type: "state_labor" },

  // ── Rhode Island ──────────────────────────────────────────────────────────
  { key: "ri_tci",                jurisdiction: "RI", lawName: "Rhode Island Temporary Caregiver Insurance (TCI)",         url: "https://dlt.ri.gov/employers/employer-taxes/temporary-caregiver-insurance-tci", type: "state_labor" },
  { key: "ri_tdi",                jurisdiction: "RI", lawName: "Rhode Island Temporary Disability Insurance (TDI)",        url: "https://dlt.ri.gov/individuals/temporary-disability-tdi-and-temporary-caregiver-tci-insurance", type: "state_labor" },

  // ── South Carolina ────────────────────────────────────────────────────────
  { key: "sc_leave",              jurisdiction: "SC", lawName: "South Carolina Leave Laws",                                url: "https://llr.sc.gov/",                                 type: "state_labor" },

  // ── South Dakota ──────────────────────────────────────────────────────────
  { key: "sd_leave",              jurisdiction: "SD", lawName: "South Dakota Leave Laws",                                  url: "https://dlr.sd.gov/",                                 type: "state_labor" },

  // ── Tennessee ─────────────────────────────────────────────────────────────
  { key: "tn_maternity",          jurisdiction: "TN", lawName: "Tennessee Maternity Leave Act",                            url: "https://www.tn.gov/workforce/article/maternity-leave", type: "state_labor" },

  // ── Texas ─────────────────────────────────────────────────────────────────
  { key: "tx_leave",              jurisdiction: "TX", lawName: "Texas Leave Laws",                                         url: "https://www.twc.texas.gov/businesses/texas-payday-law#leavePolicies", type: "state_labor" },

  // ── Utah ──────────────────────────────────────────────────────────────────
  { key: "ut_leave",              jurisdiction: "UT", lawName: "Utah Leave Laws",                                          url: "https://laborcommission.utah.gov/",                   type: "state_labor" },

  // ── Vermont ───────────────────────────────────────────────────────────────
  { key: "vt_parli",              jurisdiction: "VT", lawName: "Vermont Parental and Family Leave Act & Paid Leave Insurance", url: "https://labor.vermont.gov/workforce-development/paid-family-leave", type: "state_labor" },

  // ── Virginia ──────────────────────────────────────────────────────────────
  { key: "va_leave",              jurisdiction: "VA", lawName: "Virginia Leave Laws",                                      url: "https://www.doli.virginia.gov/labor-law/employment-discrimination-laws/",type: "state_labor" },

  // ── Washington ────────────────────────────────────────────────────────────
  { key: "wa_pfml",               jurisdiction: "WA", lawName: "Washington Paid Family and Medical Leave (WA PFML)",       url: "https://paidleave.wa.gov/",                           type: "state_labor" },
  { key: "wa_fla",                jurisdiction: "WA", lawName: "Washington Family Leave Act",                              url: "https://lni.wa.gov/workers-rights/leave/family-care/",type: "state_labor" },
  { key: "wa_psst",               jurisdiction: "WA", lawName: "Washington Paid Sick and Safe Time",                       url: "https://lni.wa.gov/workers-rights/leave/paid-sick-leave/", type: "state_labor" },
  { key: "wa_lsaa",               jurisdiction: "WA", lawName: "Washington Long-Term Services and Supports Trust (WA Cares Fund)", url: "https://wacaresfund.wa.gov/",         type: "state_labor" },

  // ── West Virginia ─────────────────────────────────────────────────────────
  { key: "wv_leave",              jurisdiction: "WV", lawName: "West Virginia Leave Laws",                                 url: "https://labor.wv.gov/",                               type: "state_labor" },

  // ── Wisconsin ─────────────────────────────────────────────────────────────
  { key: "wi_fmla",               jurisdiction: "WI", lawName: "Wisconsin Family and Medical Leave Act (WFMLA)",           url: "https://dwd.wisconsin.gov/er/civilrights/family_medical_leave.htm", type: "state_labor" },

  // ── Wyoming ───────────────────────────────────────────────────────────────
  { key: "wy_leave",              jurisdiction: "WY", lawName: "Wyoming Leave Laws",                                       url: "https://wyomingworkforce.org/",                       type: "state_labor" },
];

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Leavara-LeaveIQ-LegalRAG/1.0 (automated compliance research)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip HTML tags
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s{3,}/g, "\n\n")
      .trim()
      .slice(0, 50000); // cap per source
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Scrape a single source and upsert into RAG + update knowledge source record.
 */
export async function scrapeSource(source: LeaveSource): Promise<"ok" | "failed" | "flagged">{
  logger.info({ key: source.key }, "Scraping leave law source");

  // Fetch primary URL
  let content = await fetchText(source.url);
  if (!content) {
    // Try supplement URLs if available
    for (const suppUrl of source.supplementUrls ?? []) {
      content = await fetchText(suppUrl);
      if (content) break;
    }
  }

  // Look up existing source record
  const [existing] = await db
    .select()
    .from(leaveKnowledgeSourcesTable)
    .where(eq(leaveKnowledgeSourcesTable.sourceKey, source.key))
    .limit(1);

  if (!content) {
    const failures = parseInt(existing?.consecutiveFailures ?? "0") + 1;
    const shouldFlag = failures >= 3;
    if (existing) {
      await db.update(leaveKnowledgeSourcesTable).set({
        lastScrapedAt: new Date(),
        consecutiveFailures: String(failures),
        flaggedForReview: shouldFlag,
        flagReason: shouldFlag ? `Source failed to scrape ${failures} consecutive times: ${source.url}` : existing.flagReason,
        updatedAt: new Date(),
      }).where(eq(leaveKnowledgeSourcesTable.sourceKey, source.key));
    } else {
      await db.insert(leaveKnowledgeSourcesTable).values({
        sourceKey: source.key,
        jurisdiction: source.jurisdiction,
        lawName: source.lawName,
        sourceUrl: source.url,
        sourceType: source.type,
        lastScrapedAt: new Date(),
        consecutiveFailures: "1",
        flaggedForReview: false,
      });
    }
    logger.warn({ key: source.key }, "Failed to scrape leave law source");
    return "failed";
  }

  const hash = sha256(content);
  const contentChanged = existing?.contentHash && existing.contentHash !== hash;

  // Build rich document text
  const docText = `JURISDICTION: ${source.jurisdiction === "federal" ? "Federal (United States)" : source.jurisdiction}\nLAW: ${source.lawName}\nSOURCE: ${source.url}\nLAST UPDATED: ${new Date().toISOString().split("T")[0]}\n\n${content}`;

  // Ingest into RAG (organizationId = null → shared across all orgs)
  const ragDocId = await ingestDocument({
    name: `[LEAVE_LAW] ${source.lawName}`,
    sourceType: "leave_law_government",
    fullText: docText,
    organizationId: null,
  });

  // Upsert source record
  const sourceData = {
    jurisdiction: source.jurisdiction,
    lawName: source.lawName,
    sourceUrl: source.url,
    sourceType: source.type,
    lastScrapedAt: new Date(),
    lastSuccessAt: new Date(),
    contentHash: hash,
    consecutiveFailures: "0",
    flaggedForReview: contentChanged ? true : false,
    flagReason: contentChanged ? `Content changed since last scrape — verify update is legitimate: ${source.url}` : null,
    ragDocumentId: ragDocId,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(leaveKnowledgeSourcesTable).set(sourceData).where(eq(leaveKnowledgeSourcesTable.sourceKey, source.key));
  } else {
    await db.insert(leaveKnowledgeSourcesTable).values({ sourceKey: source.key, ...sourceData });
  }

  logger.info({ key: source.key, changed: contentChanged }, "Scraped leave law source");
  return contentChanged ? "flagged" : "ok";
}

/**
 * Run the full daily scrape of all leave law sources.
 * Called by cron job.
 */
export async function runDailyScrape(): Promise<{ ok: number; failed: number; flagged: number }> {
  logger.info("Starting daily leave law knowledge scrape");
  let ok = 0, failed = 0, flagged = 0;

  // Process in batches of 5 to avoid overwhelming servers
  const batchSize = 5;
  for (let i = 0; i < ALL_LEAVE_SOURCES.length; i += batchSize) {
    const batch = ALL_LEAVE_SOURCES.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((s) => scrapeSource(s)));
    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value === "ok") ok++;
        else if (r.value === "flagged") flagged++;
        else failed++;
      } else {
        failed++;
      }
    }
    // Polite delay between batches
    if (i + batchSize < ALL_LEAVE_SOURCES.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  logger.info({ ok, failed, flagged }, "Daily leave law scrape complete");
  return { ok, failed, flagged };
}
