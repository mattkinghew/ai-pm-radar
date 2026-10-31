export type CompanionLocation = {
  protocol: string;
  hostname: string;
};

export class CompanionApiError extends Error {
  code: string;
  status: number;
  payload: Record<string, unknown> | null;

  constructor(code: string, message: string, status = 0, payload: Record<string, unknown> | null = null) {
    super(message);
    this.name = "CompanionApiError";
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

const configuredApiBase = process.env.NEXT_PUBLIC_AI_PM_RADAR_API_BASE?.trim().replace(/\/$/u, "") ?? "";

function currentLocation(): CompanionLocation | null {
  if (typeof window === "undefined") return null;
  return { protocol: window.location.protocol, hostname: window.location.hostname };
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function companionApiUrl(
  pathname: string,
  location: CompanionLocation | null = currentLocation(),
  helperPort = process.env.NEXT_PUBLIC_AI_PM_RADAR_FETCH_PORT ?? "4310",
) {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new Error("Companion API paths must start with one slash.");
  }
  if (configuredApiBase) return `${configuredApiBase}${pathname}`;
  if (process.env.NODE_ENV !== "production" && (!location || isLoopbackHostname(location.hostname))) {
    return `http://127.0.0.1:${helperPort}${pathname}`;
  }
  return `/api${pathname}`;
}

export async function parseCompanionJsonResponse<T = unknown>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    let accessLoginHost = false;
    try {
      accessLoginHost = new URL(response.url).hostname.toLowerCase().endsWith(".cloudflareaccess.com");
    } catch {
      // Synthetic Response objects and some fetch implementations have no absolute response URL.
    }
    const looksLikeAccessLogin = response.status === 401 || response.status === 403
      || response.redirected || accessLoginHost;
    throw new CompanionApiError(
      looksLikeAccessLogin ? "access_session_expired" : "companion_invalid_response",
      looksLikeAccessLogin
        ? "The protected session expired. Sign in again, then retry."
        : "The companion service returned a non-JSON response.",
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CompanionApiError("companion_invalid_response", "The companion service returned invalid JSON.", response.status);
  }

  if (!response.ok) {
    const value = payload && typeof payload === "object" ? payload as { code?: unknown; error?: unknown } : {};
    const code = typeof value.code === "string"
      ? value.code
      : response.status === 401 || response.status === 403
        ? "access_session_expired"
        : response.status === 503
          ? "companion_service_unavailable"
          : "companion_request_failed";
    const message = typeof value.error === "string" ? value.error : "The companion request failed.";
    throw new CompanionApiError(
      code,
      message,
      response.status,
      payload && typeof payload === "object" ? payload as Record<string, unknown> : null,
    );
  }

  return payload as T;
}

export async function requestCompanionJson<T = unknown>(pathname: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(companionApiUrl(pathname), {
      cache: "no-store",
      ...init,
      headers: {
        accept: "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new CompanionApiError("companion_service_unavailable", "The local companion service is unavailable.");
  }
  return parseCompanionJsonResponse<T>(response);
}
