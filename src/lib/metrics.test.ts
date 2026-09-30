import { describe, it, expect, vi } from "vitest";
import { countSyllables, calculateReadability, calculateDocumentQuality } from "./metrics";

vi.mock("./db", () => ({
  db: {},
}));

describe("countSyllables", () => {
  it("should count syllables in simple words", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("beautiful")).toBeGreaterThan(2);
  });

  it("should handle known exceptions", () => {
    expect(countSyllables("area")).toBe(3);
    expect(countSyllables("idea")).toBe(3);
    expect(countSyllables("prioritize")).toBe(4);
  });

  it("should return 0 for empty input", () => {
    expect(countSyllables("")).toBe(0);
    expect(countSyllables("   ")).toBe(0);
  });
});

describe("calculateReadability", () => {
  it("should return 100 for empty text", () => {
    const result = calculateReadability("");
    expect(result.fleschScore).toBe(100);
    expect(result.words).toBe(0);
  });

  it("should calculate readability for simple text", () => {
    const result = calculateReadability("The cat sat on the mat.");
    expect(result.words).toBe(6);
    expect(result.sentences).toBe(1);
    expect(result.fleschScore).toBeGreaterThan(80);
  });

  it("should accept custom grade levels", () => {
    const levels = [{ minScore: 50, label: "Custom Level" }];
    const result = calculateReadability("Very complex and difficult language used here indeed.", levels);
    expect(result.gradeLevel).toBeDefined();
  });
});

describe("calculateDocumentQuality", () => {
  it("should return 100 for perfect text", () => {
    expect(calculateDocumentQuality("Hello world", [])).toBe(100);
  });

  it("should deduct points for corrections", () => {
    const score = calculateDocumentQuality("Hello world", [
      { category: "GRAMMAR" },
      { category: "CLARITY" },
    ]);
    expect(score).toBeLessThan(100);
  });

  it("should use custom weights", () => {
    const score = calculateDocumentQuality("Hello world", [
      { category: "GRAMMAR" },
    ], { GRAMMAR: 5 });
    expect(score).toBe(95);
  });

  it("should not go below 10", () => {
    const score = calculateDocumentQuality("Hello world", [
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
      { category: "GRAMMAR" },
    ]);
    expect(score).toBeGreaterThanOrEqual(10);
  });

  it("should handle empty text", () => {
    expect(calculateDocumentQuality("", [])).toBe(100);
  });
});
