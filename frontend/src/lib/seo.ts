import { markdownToPlainText } from "@/lib/markdown";

export const DEFAULT_SITE_URL = "https://opennoesis.com";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}

export function buildAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function canonicalPath(path: string): string {
  if (path === "/") {
    return "/";
  }
  return path.replace(/\/+$/, "");
}

export function sanitizeTextForMeta(value: string, maxLength = 160): string {
  const compact = markdownToPlainText(value);
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}
