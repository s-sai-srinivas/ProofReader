import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRateLimited } from "./rateLimit";
import { db } from "./db";
import { logError } from "./logger";

vi.mock("./db", () => ({
  db: {
    rateLimit: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("./logger", () => ({
  logError: vi.fn(),
}));

describe("rateLimit library (src/lib/rateLimit)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // Default to not trigger cleanups
  });

  it("should return false if rate limit has not been exceeded", async () => {
    vi.mocked(db.rateLimit.upsert).mockResolvedValue({
      key: "user-1",
      windowStart: new Date(),
      count: 5,
    });

    const isLimited = await isRateLimited("user-1", 10, 60000);
    expect(isLimited).toBe(false);
    expect(db.rateLimit.upsert).toHaveBeenCalled();
  });

  it("should return true if rate limit is exceeded", async () => {
    vi.mocked(db.rateLimit.upsert).mockResolvedValue({
      key: "user-1",
      windowStart: new Date(),
      count: 11,
    });

    const isLimited = await isRateLimited("user-1", 10, 60000);
    expect(isLimited).toBe(true);
  });

  it("should fall back to in-memory counting if the database operation fails", async () => {
    const testError = new Error("Database offline");
    vi.mocked(db.rateLimit.upsert).mockRejectedValue(testError);

    const isLimited = await isRateLimited("user-1", 10, 60000);
    expect(isLimited).toBe(false);
    expect(logError).toHaveBeenCalledWith("RATE_LIMITING_DB_FALLBACK", testError);
  });

  it("should block using in-memory fallback when DB is down and limit is exceeded", async () => {
    const testError = new Error("Database offline");
    vi.mocked(db.rateLimit.upsert).mockRejectedValue(testError);

    // Exhaust the limit (10 requests)
    for (let i = 0; i < 10; i++) {
      await isRateLimited("user-1", 10, 60000);
    }

    // 11th request should be blocked even though DB is down
    const blocked = await isRateLimited("user-1", 10, 60000);
    expect(blocked).toBe(true);
  });

  it("should trigger garbage collection of old rate limits when Math.random returns less than 0.01", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.005); // Triggers GC
    vi.mocked(db.rateLimit.upsert).mockResolvedValue({
      key: "user-1",
      windowStart: new Date(),
      count: 2,
    });
    vi.mocked(db.rateLimit.deleteMany).mockResolvedValue({ count: 5 });

    const isLimited = await isRateLimited("user-1", 10, 60000);
    expect(isLimited).toBe(false);
    expect(db.rateLimit.deleteMany).toHaveBeenCalled();
  });

  it("should handle error in garbage collection gracefully", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.005); // Triggers GC
    vi.mocked(db.rateLimit.upsert).mockResolvedValue({
      key: "user-1",
      windowStart: new Date(),
      count: 2,
    });
    const gcError = new Error("GC failure");
    vi.mocked(db.rateLimit.deleteMany).mockRejectedValue(gcError);

    const isLimited = await isRateLimited("user-1", 10, 60000);
    expect(isLimited).toBe(false);
    expect(logError).toHaveBeenCalledWith("RATE_LIMIT_CLEANUP", gcError);
  });
});
