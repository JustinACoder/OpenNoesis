import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

// Detect server vs. client
const isServer = typeof window === "undefined";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function queryServerForCSRFCookie(): Promise<string | undefined> {
  return await fetch(apiUrl + "/set-csrf-token", {
    method: "GET",
    credentials: "include", // Ensure cookies are sent
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch CSRF token");
      }
      const jsonResponse = await response.json();
      return jsonResponse.csrftoken || undefined;
    })
    .catch((error) => {
      console.error("Error fetching CSRF token:", error);
      return undefined;
    });
}

/**
 * Read the `csrftoken` cookie:
 * - Client: from document.cookie
 * - Server: from Next.js App Router cookies()
 */
async function getCSRFTokenFromCookie(): Promise<string | undefined> {
  if (isServer) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    return cookieStore.get("csrftoken")?.value;
  } else {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrftoken="));
    if (!raw) return undefined;
    const [, v] = raw.split(/=(.+)/); // split on first '='
    return v ? decodeURIComponent(v) : undefined;
  }
}

async function getCSRFToken(): Promise<string | undefined> {
  let csrftoken: string | undefined;
  // First, try to get it from the cookie
  csrftoken = await getCSRFTokenFromCookie();

  // If we still don't have it, query the server
  if (!csrftoken) {
    console.warn("Could not find CSRF token, querying server...");
    csrftoken = await queryServerForCSRFCookie();
  }
  return csrftoken;
}

/**
 * Parse a single Set-Cookie header string into name, value, and attrs.
 */
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

export const apiClient = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // browser: send cookies; SSR: we’ll forward manually
});

// REQUEST: forward cookies on SSR, add X-CSRFToken on unsafe methods
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1) SSR: grab incoming cookies and replay them
    if (isServer) {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const cookieHeader = cookieStore.toString(); // "sessionid=…; csrftoken=…"
      if (cookieHeader) {
        config.headers.set("Cookie", cookieHeader);
      }
    }

    // 2) Add CSRF header on unsafe methods
    const method = (config.method || "").toLowerCase();
    if (["post", "put", "patch", "delete"].includes(method)) {
      const token = await getCSRFToken();
      if (token) {
        config.headers.set("X-CSRFToken", token);
      }
    }

    return config;
  },
);

// RESPONSE: parse any Set-Cookie headers on SSR and propagate them
// we also handle 401 Unauthorized responses to redirect to login
apiClient.interceptors.response.use(
  async (response: AxiosResponse) => {
    if (isServer) {
      const rawSet = response.headers["set-cookie"];
      if (rawSet) {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();

        const list = Array.isArray(rawSet) ? rawSet : [rawSet];
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

    return response;
  },
  async (error: AxiosError) => {
    const response = error.response;

    if (!response) {
      // If there's no response, it might be a network error or timeout
      return Promise.reject(error);
    }

    if (isServer) {
      if (response.status === 401) {
        // Handle 401 Unauthorized by redirecting to login
        const { redirect } = await import("next/navigation");
        if (
          response.config.method?.toLowerCase() === "get" &&
          response.config.url
        ) {
          redirect("/login?next=" + encodeURIComponent(response.config.url));
        } else {
          // For non-GET requests, redirect to login without a next parameter
          redirect("/login");
        }
      }
    }

    return Promise.reject(error);
  },
);

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = axios.CancelToken.source();
  const promise = apiClient({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  promise.cancel = () => {
    source.cancel("Query was cancelled");
  };

  return promise;
};
