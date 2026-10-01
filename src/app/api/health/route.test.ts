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
    ai: {
      apiKey: "some-long-ai-api-key-here-for-test",
    },
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return 200 and 'ok' status when DB query succeeds and AI key is configured", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([1]);
    config.ai.apiKey = "valid-length-ai-key-123456789";

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.ai.status).toBe("ok");
    expect(body.checks.ai.configured).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it("should return 503 and 'degraded' status if database query throws an error", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error("DB error"));
    config.ai.apiKey = "valid-length-ai-key-123456789";

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.ai.status).toBe("ok");
  });

  it("should return 503 and 'degraded' status if AI API key is missing or too short", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([1]);
    config.ai.apiKey = "short";

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.ai.status).toBe("error");
    expect(body.checks.ai.configured).toBe(false);
  });
});
