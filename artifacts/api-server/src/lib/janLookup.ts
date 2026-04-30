/**
 * Job Accommodation Network (JAN) lookup utilities.
 *
 * JAN does not have a public REST API or webhooks. This module performs
 * live web fetches against JAN's publicly accessible pages and parses
 * the text content to provide relevant accommodation guidance to Ada.
 *
 * Sources used:
 *   - A-to-Z topic index: https://askjan.org/a-to-z.cfm
 *   - Individual topic pages: https://askjan.org/topics/{TOPIC}.cfm
 *   - Search results: https://askjan.org/search.cfm?q={QUERY}
 *   - Limitation-based lookup: https://askjan.org/soar/index.cfm (Searchable Online Accommodation Resource)
 */

import { logger } from "./logger.js";

const JAN_BASE = "https://askjan.org";
const FETCH_TIMEOUT_MS = 8000;

// Known JAN topic slugs indexed by common ADA limitation categories
const LIMITATION_TO_JAN_TOPICS: Record<string, string[]> = {
  mobility: ["mobility-impairments", "standing", "lifting"],
  hearing: ["hearing-impairments", "deafness"],
  vision: ["vision-impairments", "blindness"],
  mental_health: ["mental-health-impairments", "anxiety", "depression", "ptsd", "adhd"],
  cognitive: ["cognitive-impairments", "learning-disabilities", "adhd"],
  chronic_pain: ["chronic-fatigue-syndrome", "fibromyalgia", "chronic-pain"],
  seizure: ["seizure-disorders", "epilepsy"],
  cancer: ["cancer", "chemotherapy-side-effects"],
  diabetes: ["diabetes"],
  heart: ["heart-conditions", "cardiovascular-impairments"],
  respiratory: ["respiratory-impairments", "asthma"],
  pregnancy: ["pregnancy-related-impairments"],
  back: ["back-impairments"],
  hand_arm: ["hand-arm-impairments", "carpal-tunnel-syndrome"],
  fatigue: ["chronic-fatigue-syndrome", "fatigue"],
  speech: ["speech-impairments"],
  autism: ["autism-spectrum-disorders"],
};

function inferTopicsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const topics: Set<string> = new Set();
  for (const [key, slugs] of Object.entries(LIMITATION_TO_JAN_TOPICS)) {
    if (lower.includes(key.replace(/_/g, " ")) || lower.includes(key.replace(/_/g, ""))) {
      slugs.forEach((s) => topics.add(s));
    }
  }
  // Always include generic accommodation topic
  topics.add("reasonable-accommodation");
  return Array.from(topics).slice(0, 4); // cap to avoid too many fetches
}

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Leavara-Ada-ADA-Assistant/1.0 (compliance research; contact admin@leavara.com)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

function extractMainContent(html: string, maxChars = 3000): string {
  // Try to extract the main content div
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i) ??
    html.match(/<div[^>]*id="main[^"]*"[\s\S]*?<\/div>/i) ??
    html.match(/<div[^>]*class="[^"]*content[^"]*"[\s\S]*?<\/div>/i);
  const source = mainMatch ? mainMatch[0] : html;
  const text = stripHtml(source);
  return text.slice(0, maxChars);
}

export interface JanResult {
  topicUrl: string;
  topicSlug: string;
  summary: string;
  citation: string;
}

/**
 * Look up accommodation ideas from JAN for a given disability/limitation description.
 * Returns an array of results with citations for Ada to include in responses.
 */
export async function lookupJanAccommodations(
  limitationDescription: string,
  jobContext?: string,
): Promise<JanResult[]> {
  const topics = inferTopicsFromText(limitationDescription);
  const results: JanResult[] = [];

  // Also do a keyword search on JAN
  const searchQuery = encodeURIComponent(
    `${limitationDescription} ${jobContext ?? ""}`.trim().slice(0, 100),
  );

  const fetches = topics.map(async (slug) => {
    const url = `${JAN_BASE}/topics/${slug}.cfm`;
    try {
      const html = await fetchWithTimeout(url);
      const content = extractMainContent(html, 2500);
      if (content.length > 100) {
        results.push({
          topicSlug: slug,
          topicUrl: url,
          summary: content,
          citation: `Job Accommodation Network — ${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${url}`,
        });
      }
    } catch (err) {
      logger.warn({ err, slug }, "JAN topic fetch failed");
    }
  });

  // Also fetch search results page
  const searchFetch = (async () => {
    try {
      const url = `${JAN_BASE}/search.cfm?q=${searchQuery}&cx=partner-pub-6601580690765438%3Aaug-g12b5&cof=FORID%3A10&ie=UTF-8`;
      const html = await fetchWithTimeout(url);
      const content = extractMainContent(html, 2000);
      if (content.length > 100) {
        results.push({
          topicSlug: "search-results",
          topicUrl: `${JAN_BASE}/search.cfm?q=${searchQuery}`,
          summary: content,
          citation: `Job Accommodation Network — Search Results for "${limitationDescription.slice(0, 60)}": ${JAN_BASE}/search.cfm?q=${searchQuery}`,
        });
      }
    } catch (err) {
      logger.warn({ err }, "JAN search fetch failed");
    }
  })();

  await Promise.all([...fetches, searchFetch]);

  return results.slice(0, 5); // cap to 5 results
}

/**
 * Formats JAN results into a concise string block for inclusion in Ada's system prompt.
 */
export function formatJanResultsForPrompt(results: JanResult[]): string {
  if (results.length === 0) {
    return "[JAN LOOKUP: No results retrieved — advise employee to contact JAN directly at 1-800-526-7234 or https://askjan.org]";
  }
  const blocks = results.map((r, i) => `--- JAN Source ${i + 1} ---\nURL: ${r.topicUrl}\n${r.summary}`);
  return `[JAN LIVE LOOKUP RESULTS]\n${blocks.join("\n\n")}\n\n[End JAN Results — cite these sources in your response]`;
}
