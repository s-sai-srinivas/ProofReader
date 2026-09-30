import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { db } from "@/lib/db";
import { config } from "@/lib/config";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/config", () => ({
  config: {
    gemini: {
      apiKey: "some-long-gemini-api-key-here-for-test",
    },
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return 200 and 'ok' status when DB query succeeds and Gemini key is configured", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([1]);
    config.gemini.apiKey = "valid-length-gemini-key-123456789";

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.gemini.status).toBe("ok");
    expect(body.checks.gemini.configured).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it("should return 503 and 'degraded' status if database query throws an error", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error("DB error"));
    config.gemini.apiKey = "valid-length-gemini-key-123456789";

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.gemini.status).toBe("ok");
  });

  it("should return 503 and 'degraded' status if Gemini API key is missing or too short", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([1]);
    config.gemini.apiKey = "short";

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.gemini.status).toBe("error");
    expect(body.checks.gemini.configured).toBe(false);
  });
});
