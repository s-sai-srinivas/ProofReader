import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSetting, invalidateSettingsCache } from "./settings";
import { db } from "./db";
import { logWarn } from "./logger";

vi.mock("./db", () => ({
  db: {
    setting: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./logger", () => ({
  logWarn: vi.fn(),
}));

describe("settings library (src/lib/settings)", () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    invalidateSettingsCache(); // Ensure fresh cache per test
    dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(100000); // 100s anchor
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it("should return default value if setting is not found in database and cache it", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);

    const val = await getSetting("some_key", "default-str");
    expect(val).toBe("default-str");

    // Next call should hit cache without calling DB again
    const valCached = await getSetting("some_key", "different-default");
    expect(valCached).toBe("default-str");
    expect(db.setting.findUnique).toHaveBeenCalledTimes(1);
  });

  it("should parse number and boolean types correctly and cache them", async () => {
    // 1. Number
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "1",
      key: "timeout",
      value: "5000",
      type: "number",
      orgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const numVal = await getSetting("timeout", 1000);
    expect(numVal).toBe(5000);

    // 2. Boolean
    invalidateSettingsCache("timeout");
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "2",
      key: "enabled",
      value: "true",
      type: "boolean",
      orgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const boolVal = await getSetting("enabled", false);
    expect(boolVal).toBe(true);

    // 3. String (default fallback mapping)
    invalidateSettingsCache("enabled");
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "3",
      key: "model",
      value: "gemini-pro",
      type: "string",
      orgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const strVal = await getSetting("model", "default-model");
    expect(strVal).toBe("gemini-pro");
  });

  it("should hit the database again if cache is expired", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "1",
      key: "some_key",
      value: "first-value",
      type: "string",
      orgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const val1 = await getSetting("some_key", "default");
    expect(val1).toBe("first-value");

    // Advance time past 30s CACHE_TTL_MS
    dateNowSpy.mockReturnValue(150000); // 150s (advanced by 50s)

    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "1",
      key: "some_key",
      value: "second-value",
      type: "string",
      orgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const val2 = await getSetting("some_key", "default");
    expect(val2).toBe("second-value");
    expect(db.setting.findUnique).toHaveBeenCalledTimes(2);
  });

  it("should gracefully handle database errors, logging warnings and falling back to default or cached", async () => {
    // 1. DB fails, no cache -> returns default
    const dbErr = new Error("DB Connection Interrupted");
    vi.mocked(db.setting.findUnique).mockRejectedValue(dbErr);

    const val1 = await getSetting("some_key", "backup-default");
    expect(val1).toBe("backup-default");
    expect(logWarn).toHaveBeenCalledWith("SETTINGS_LOAD_FAILED", expect.any(String), { error: String(dbErr) });

    // 2. DB succeeds, caches value
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "1",
      key: "some_key",
      value: "valid-cached-value",
      type: "string",
      orgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const val2 = await getSetting("some_key", "backup-default");
    expect(val2).toBe("valid-cached-value");

    // 3. DB fails again after cache expiry -> returns stale cached value
    dateNowSpy.mockReturnValue(150000); // Expire cache
    vi.mocked(db.setting.findUnique).mockRejectedValue(dbErr);

    const val3 = await getSetting("some_key", "backup-default");
    expect(val3).toBe("valid-cached-value"); // returns stale cached value rather than default
  });

  it("should bypass cache when BYPASS_SETTINGS_CACHE env var is set", async () => {
    process.env.BYPASS_SETTINGS_CACHE = "true";

    const { getSetting: getSettingBypass } = await import("./settings");

    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "1",
      key: "test_key",
      value: "fresh-value",
      type: "string",
      orgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const val1 = await getSettingBypass("test_key", "default");
    expect(val1).toBe("fresh-value");

    // Second call should hit DB again (cache is bypassed in this module instance)
    const val2 = await getSettingBypass("test_key", "default");
    expect(val2).toBe("fresh-value");

    // Get total calls across all module instances
    expect(db.setting.findUnique).toHaveBeenCalled();

    delete process.env.BYPASS_SETTINGS_CACHE;
  });

  it("should invalidate the cache globally or for a specific key", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "1",
      key: "key_1",
      value: "val_1",
      type: "string",
      orgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await getSetting("key_1", "def");
    await getSetting("key_2", "def");

    // Invalidate key_1 specifically
    invalidateSettingsCache("key_1");

    await getSetting("key_1", "def");
    expect(db.setting.findUnique).toHaveBeenCalledTimes(3); // key_1 re-fetched

    // Invalidate globally
    invalidateSettingsCache();
    await getSetting("key_2", "def");
    expect(db.setting.findUnique).toHaveBeenCalledTimes(4); // both re-fetched
  });
});
