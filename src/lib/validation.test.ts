import { describe, it, expect, vi } from "vitest";
import { RegisterSchema, LoginSchema, ProofreadSchema, RuleSchema } from "./validation";

vi.mock("./db", () => ({
  db: {
    category: {
      findFirst: vi.fn(),
    },
  },
}));

describe("RegisterSchema", () => {
  it("should accept valid registration data", () => {
    const result = RegisterSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "Str0ng!Pass",
    });
    expect(result.success).toBe(true);
  });

  it("should reject weak passwords", () => {
    const result = RegisterSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "weak",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.format().password).toBeDefined();
    }
  });

  it("should reject missing name", () => {
    const result = RegisterSchema.safeParse({
      email: "john@example.com",
      password: "Str0ng!Pass",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = RegisterSchema.safeParse({
      name: "John",
      email: "not-an-email",
      password: "Str0ng!Pass",
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional orgName", () => {
    const result = RegisterSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "Str0ng!Pass",
      orgName: "Acme Corp",
    });
    expect(result.success).toBe(true);
  });
});

describe("LoginSchema", () => {
  it("should accept valid login data", () => {
    const result = LoginSchema.safeParse({
      email: "john@example.com",
      password: "any-password",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = LoginSchema.safeParse({
      email: "not-email",
      password: "password",
    });
    expect(result.success).toBe(false);
  });
});

describe("ProofreadSchema", () => {
  it("should accept valid content", () => {
    const result = ProofreadSchema.safeParse({
      content: "This is a test sentence.",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty content", () => {
    const result = ProofreadSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });
});

describe("RuleSchema", () => {
  it("should accept valid rule data", () => {
    const result = RuleSchema.safeParse({
      pattern: "test",
      replacement: "fixed",
      category: "GRAMMAR",
      explanation: "Fix test typo",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing pattern", () => {
    const result = RuleSchema.safeParse({
      replacement: "fixed",
      category: "GRAMMAR",
      explanation: "Fix",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing category", () => {
    const result = RuleSchema.safeParse({
      pattern: "test",
      explanation: "Fix",
    });
    expect(result.success).toBe(false);
  });
});
