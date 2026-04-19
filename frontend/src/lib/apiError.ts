interface ApiLikeError {
  kind?: string;
  status?: number;
  code?: string;
  detail?: unknown;
  data?: unknown;
  message?: string;
  name?: string;
}

export interface TransportError {
  kind: "transport";
  message: string;
  cause?: unknown;
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

function getErrorFlows(error: unknown): { id?: string; is_pending?: boolean }[] {
  const parsed = toApiLikeError(error);
  if (!parsed || !parsed.data || typeof parsed.data !== "object") {
    return [];
  }

  const maybeFlows = (parsed.data as { flows?: unknown }).flows;
  if (!Array.isArray(maybeFlows)) {
    return [];
  }

  return maybeFlows.filter(
    (flow): flow is { id?: string; is_pending?: boolean } =>
      !!flow && typeof flow === "object",
  );
}

export function hasPendingFlow(error: unknown, flowId: string): boolean {
  return getErrorFlows(error).some(
    (flow) => flow.id === flowId && flow.is_pending === true,
  );
}

export function createTransportError(
  message: string,
  cause?: unknown,
): TransportError {
  return {
    kind: "transport",
    message,
    cause,
  };
}

export function isTransportError(error: unknown): error is TransportError {
  const parsed = toApiLikeError(error);
  return parsed?.kind === "transport";
}

export function isRetryableTransportError(error: unknown): boolean {
  return isTransportError(error);
}
