type FetchInput = RequestInfo | URL;
type FetchInit = RequestInit | undefined;

function parseBody(body: BodyInit | null | undefined): unknown {
  if (!body) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

function formatUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function createLoggedFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input: FetchInput, init?: FetchInit) => {
    const url = formatUrl(input);
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    const requestBody = parseBody(init?.body ?? (input instanceof Request ? undefined : undefined));

    if (import.meta.env.DEV) {
      const label = url.includes("/auth/v1/")
        ? "AUTH"
        : url.includes("/rest/v1/")
          ? "API"
          : "FETCH";

      console.groupCollapsed(
        `%c[B2B ${label}] ${method} ${url}`,
        "color:#818cf8;font-weight:bold"
      );
      if (requestBody) console.log("Request payload:", requestBody);
      if (init?.headers) console.log("Headers:", init.headers);
      console.groupEnd();
    }

    const response = await baseFetch(input, init);

    if (import.meta.env.DEV) {
      const clone = response.clone();
      void clone
        .text()
        .then(text => {
          let parsed: unknown = text;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = text;
          }
          console.groupCollapsed(
            `%c[B2B Response] ${response.status} ${method} ${url}`,
            response.ok ? "color:#34d399;font-weight:bold" : "color:#f87171;font-weight:bold"
          );
          console.log("Response body:", parsed);
          console.groupEnd();
        })
        .catch(() => {});
    }

    return response;
  };
}

export function installNetworkDebug() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if ((window as Window & { __b2bNetworkDebug?: boolean }).__b2bNetworkDebug) return;

  const loggedFetch = createLoggedFetch(window.fetch.bind(window));
  window.fetch = loggedFetch;
  (window as Window & { __b2bNetworkDebug?: boolean }).__b2bNetworkDebug = true;
}
