import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeEmail } from "./sanitize";

describe("sanitizeText", () => {
  it("should strip HTML tags", () => {
    expect(sanitizeText("<script>alert('xss')</script>hello")).toBe("hello");
  });

  it("should strip HTML event handlers", () => {
    expect(sanitizeText('<img onerror="alert(1)" src=x>')).toBe("");
  });

  it("should strip javascript: URLs", () => {
    expect(sanitizeText('<a href="javascript:alert(1)">click</a>')).toBe("click");
  });

  it("should keep normal text unchanged", () => {
    expect(sanitizeText("Hello, world!")).toBe("Hello, world!");
  });

  it("should trim whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  it("should return empty string for empty input", () => {
    expect(sanitizeText("")).toBe("");
    expect(sanitizeText("   ")).toBe("");
  });
});

describe("sanitizeEmail", () => {
  it("should lowercase email", () => {
    expect(sanitizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("should trim email", () => {
    expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
  });
});
