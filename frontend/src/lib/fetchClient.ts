import { createTransportError } from "@/lib/apiError";

const isServer = typeof window === "undefined";

async function getServerCookieStore() {
  if (!isServer) throw new Error("cookies() only available on server");
  const { cookies } = await import("next/headers");
  return cookies();
}

function getApiUrl() {
  if (isServer) return process.env.DOCKER_API_URL;
  return process.env.NEXT_PUBLIC_API_URL || "";
}

/* ---------------- CSRF Handling ---------------- */
async function queryServerForCSRFCookie(): Promise<string | undefined> {
  try {
    const headers = new Headers();

    if (isServer) {
      headers.set("X-Forwarded-Proto", "https"); // If we are not on the server, this is overridden by nginx
    }

    const res = await fetch(getApiUrl() + "/api/set-csrf-token", {
      method: "GET",
      credentials: "include",
      headers: headers,
    });
    if (!res.ok) throw new Error("Response not OK");
    const json = await res.json();
    return json.csrftoken || undefined;
  } catch (err) {
    console.error("Error fetching CSRF token:", err);
    return undefined;
  }
}

async function getCSRFTokenFromCookie(): Promise<string | undefined> {
  if (isServer) {
    const cookieStore = await getServerCookieStore();
    return cookieStore.get("csrftoken")?.value;
  } else {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrftoken="));
    if (!raw) return undefined;
    const [, v] = raw.split(/=(.+)/);
    return v ? decodeURIComponent(v) : undefined;
  }
}

async function getCSRFToken(): Promise<string | undefined> {
  let csrftoken = await getCSRFTokenFromCookie();
  if (!csrftoken) {
    console.warn("Could not find CSRF token, querying server...");
    csrftoken = await queryServerForCSRFCookie();
  }
  return csrftoken;
}

/* ---------------- Set-Cookie Parser ---------------- */
function parseSetCookie(raw: string) {
  const parts = raw.split(";").map((p) => p.trim());
  const [nameValue, ...attrParts] = parts;
  const [name, ...valParts] = nameValue.split(/=(.+)/);
  const value = valParts.join("=");

  const attrs: Record<string, string | boolean> = {};
  for (const part of attrParts) {
    const [k, ...v] = part.split(/=(.+)/);
    attrs[k] = v.length ? v.join("=") : true;
  }

  return { name, value, attrs };
}

/* ---------------- Main Custom Fetch ---------------- */
export const customFetch = async <T>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const method = (options.method || "GET").toUpperCase();

  // Clone headers
  const headers = new Headers(options.headers);

  // SSR: forward cookies from request
  if (isServer) {
    const cookieStore = await getServerCookieStore();
    const cookieHeader = cookieStore.toString();
    if (cookieHeader) headers.set("Cookie", cookieHeader);
  }

  // Add CSRF header on unsafe methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = await getCSRFToken();
    if (token) headers.set("X-CSRFToken", token);
  }

  // Add the X-Forwarded-Proto header if we are on the server
  if (isServer) {
    headers.set("X-Forwarded-Proto", "https"); // If we are not on the server, this is overridden by nginx
  }

  // Perform fetch
  const requestUrl = url.startsWith("http") ? url : getApiUrl() + url;
  //console.log("Fecthing URL:", requestUrl);
  const allOptions = {
    ...options,
    headers,
    credentials: "include" as const,
  };
  //const random = Math.random().toString(36).substring(2, 8);
  // if (
  //   isServer &&
  //   requestUrl === "http://localhost:8000/api/get-current-user-object"
  // ) {
  //   console.log(
  //     `[customFetch] ${method} ${requestUrl} ${random} with options:`,
  //     JSON.stringify(allOptions),
  //   );
  //   console.time("Fetch get-current-user-object " + random);
  // }
  let res: Response;
  try {
    res = await fetch(requestUrl, allOptions);
  } catch (error) {
    const fallbackMessage =
      error instanceof Error && error.message
        ? error.message
        : "Network request failed";
    throw createTransportError(fallbackMessage, error);
  }
  // if (
  //   isServer &&
  //   requestUrl === "http://localhost:8000/api/get-current-user-object"
  // ) {
  //   console.timeEnd("Fetch get-current-user-object " + random);
  // }

  // SSR: propagate any Set-Cookie headers
  if (isServer) {
    const setCookieHeaders = res.headers.get("set-cookie");
    if (setCookieHeaders) {
      const cookieStore = await getServerCookieStore();
      const list = setCookieHeaders.split(/,(?=[^;]+=[^;]+)/g);
      for (const raw of list) {
        const { name, value, attrs } = parseSetCookie(raw);
        cookieStore.set({
          name,
          value,
          path: typeof attrs.Path === "string" ? attrs.Path : "/",
          domain: typeof attrs.Domain === "string" ? attrs.Domain : undefined,
          secure: attrs.Secure === true,
          httpOnly: attrs.HttpOnly === true,
          sameSite:
            typeof attrs.SameSite === "string"
              ? (attrs.SameSite as "lax" | "strict" | "none")
              : "lax",
          maxAge:
            typeof attrs["Max-Age"] === "string"
              ? parseInt(attrs["Max-Age"], 10)
              : undefined,
          expires:
            typeof attrs.Expires === "string"
              ? new Date(attrs.Expires)
              : undefined,
        });
      }
    }
  }

  const jsonContent = await res.json().catch(() => undefined);
  if (!res.ok) {
    //throw new CustomFetchError(res.status, jsonContent, res.statusText);
    throw jsonContent; // Throw the JSON error response directly
  }

  // Return only the JSON body
  return jsonContent as T;
};

// export type ErrorType<Error> =
//   | ErrorResponse
//   | UnauthenticatedResponse
//   | ForbiddenResponse
//   | ConflictResponse
//   | SessionGoneResponse
//   | TooManyRequestsResponse;
