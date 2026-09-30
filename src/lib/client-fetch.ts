function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function clientFetch(url: string, options?: RequestInit): Promise<Response> {
  const method = options?.method || "GET";

  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      options = {
        ...options,
        headers: {
          ...options?.headers,
          "x-csrf-token": csrfToken,
        },
      };
    }
  }

  return fetch(url, options);
}
