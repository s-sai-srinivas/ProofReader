import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.stubGlobal("document", {
  cookie: "",
});

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.document.cookie = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("clientFetch", () => {
  it("should pass through GET requests without CSRF header", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const { clientFetch } = await import("./client-fetch");
    const res = await clientFetch("/api/test");

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith("/api/test", undefined);
  });

  it("should add x-csrf-token header from cookie on POST requests", async () => {
    globalThis.document.cookie = "csrf-token=my-test-token; path=/";
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const { clientFetch } = await import("./client-fetch");
    const res = await clientFetch("/api/test", { method: "POST", body: "{}" });

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      body: "{}",
      headers: {
        "x-csrf-token": "my-test-token",
      },
    });
  });

  it("should skip CSRF header when no cookie is present", async () => {
    globalThis.document.cookie = "";
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const { clientFetch } = await import("./client-fetch");
    const res = await clientFetch("/api/test", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith("/api/test", {
      method: "DELETE",
    });
  });

  it("should handle HEAD requests without CSRF header", async () => {
    const mockResponse = new Response(null, { status: 204 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const { clientFetch } = await import("./client-fetch");
    const res = await clientFetch("/api/health", { method: "HEAD" });

    expect(res.status).toBe(204);
  });
});
