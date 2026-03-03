interface ApiLikeError {
  status?: number;
  code?: string;
  detail?: unknown;
}

function toApiLikeError(error: unknown): ApiLikeError | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  return error as ApiLikeError;
}

export function isApiNotFoundError(error: unknown): boolean {
  const parsed = toApiLikeError(error);
  if (!parsed) {
    return false;
  }

  if (parsed.status === 404) {
    return true;
  }

  if (typeof parsed.code === "string" && parsed.code.toLowerCase() === "not_found") {
    return true;
  }

  if (typeof parsed.detail === "string") {
    return parsed.detail.toLowerCase().includes("not found");
  }

  return false;
}
