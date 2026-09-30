import { describe, it, expect } from "vitest";
import { ERROR_MESSAGES } from "./error-messages";

describe("ERROR_MESSAGES constants", () => {
  it("should have correct error message definitions", () => {
    expect(ERROR_MESSAGES.UNAUTHORIZED).toContain("Unauthorized access");
    expect(ERROR_MESSAGES.FORBIDDEN).toContain("Forbidden");
    expect(ERROR_MESSAGES.INTERNAL_ERROR).toContain("Internal server error");
    expect(ERROR_MESSAGES.NOT_FOUND).toContain("Resource not found");
    expect(ERROR_MESSAGES.CONFLICT).toContain("Resource already exists");
    expect(ERROR_MESSAGES.BAD_REQUEST).toContain("Bad request");
    expect(ERROR_MESSAGES.RATE_LIMIT).toContain("Too many requests");
  });
});
