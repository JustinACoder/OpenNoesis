import type { MetadataRoute } from "next";
import { debateApiSitemapCandidates } from "@/lib/api/debate";
import { buildAbsoluteUrl } from "@/lib/seo";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getSitemapCandidatesWithRetry() {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await debateApiSitemapCandidates();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_BACKOFF_MS * attempt);
      }
    }
  }

  throw lastError;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const debates = await getSitemapCandidatesWithRetry();

    return debates.map((debate) => ({
      url: buildAbsoluteUrl(`/d/${debate.slug}`),
      lastModified: new Date(debate.date),
    }));
  } catch {
    return [];
  }
}
