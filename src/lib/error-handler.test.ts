import { describe, it, expect, vi } from "vitest";
import { handleApiError } from "./error-handler";

vi.mock("./db", () => ({ db: {} }));

describe("handleApiError", () => {
  it("should return 400 for SyntaxError", () => {
    const response = handleApiError(new SyntaxError("Invalid JSON"), "TEST");
    const status = response.status;
    expect(status).toBe(400);
  });

  it("should return 500 for generic Error", () => {
    const response = handleApiError(new Error("Something broke"), "TEST");
    expect(response.status).toBe(500);
  });

  it("should return 500 for unknown errors", () => {
    const response = handleApiError("string error", "TEST");
    expect(response.status).toBe(500);
  });
});
