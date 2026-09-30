import { describe, it, expect, vi, beforeEach } from "vitest";
import { logInfo, logError } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should log info messages", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo("TEST", "info message", { key: "value" });
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    const parsed = JSON.parse(call);
    expect(parsed.level).toBe("info");
    expect(parsed.context).toBe("TEST");
    expect(parsed.message).toBe("info message");
    expect(parsed.key).toBe("value");
  });

  it("should log error messages with stack traces", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("test error");
    logError("TEST_ERR", error);
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    const parsed = JSON.parse(call);
    expect(parsed.level).toBe("error");
    expect(parsed.context).toBe("TEST_ERR");
    expect(parsed.message).toBe("test error");
    expect(parsed.stack).toBeDefined();
  });

  it("should handle non-Error objects", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("TEST", "string error");
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    const parsed = JSON.parse(call);
    expect(parsed.message).toBe("string error");
  });
});
