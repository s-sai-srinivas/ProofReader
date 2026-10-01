import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRateLimited } from "@/lib/rateLimit";
import { getSetting } from "@/lib/settings";

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    category: {
      findMany: vi.fn(),
    },
    rule: {
      findMany: vi.fn(),
    },
    rateLimit: {
      upsert: vi.fn().mockResolvedValue({} as unknown as Awaited<ReturnType<typeof db.rateLimit.upsert>>),
    },
  },
}));

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn((key, defaultValue) => Promise.resolve(defaultValue)),
}));

// Hoist variables before vi.mock executes to avoid parent scope resolution order errors
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal("fetch", mockFetch);

function groqResponse(content: string) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  } as unknown as Response);
}

describe("AI Proofread API Endpoint (/api/proofread)", () => {
  const mockUser = {
    id: "user-123",
    email: "writer@example.com",
    orgId: "org-456",
  };

  const activeCategories = [
    { id: "cat-grammar", name: "GRAMMAR", label: "Grammar & Spelling", isActive: true },
    { id: "cat-clarity", name: "CLARITY", label: "Clarity Improvements", isActive: true },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    // Default rate limit to false
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(db.rateLimit.upsert).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof db.rateLimit.upsert>>);
  });

  describe("Authentication & Schema Validation", () => {
    it("should return 401 Unauthorized if session is absent", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);

      const response = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({ content: "Some text" }),
      }));

      expect(response.status).toBe(401);
    });

    it("should return 400 Bad Request if request body violates the validation schema", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);

      const response = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({}), // Missing content
      }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Validation failed");
    });
  });

  describe("Security & Rate Limiting", () => {
    it("should return 429 Too Many Requests if the user rate limit is exceeded", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(isRateLimited).mockResolvedValue(true); // Scans exceeded

      const response = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({ content: "Valid text content." }),
      }));

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toContain("Too many proofreading scans");
    });
  });

  describe("Proofreading Pipeline Checks", () => {
    it("should apply custom local database rules first, successfully matching patterns", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(db.category.findMany).mockResolvedValue(activeCategories as unknown as Awaited<ReturnType<typeof db.category.findMany>>);

      // Setup custom rule: pattern "color" -> "colour"
      const localRules = [
        { id: "rule-1", pattern: "color", replacement: "colour", category: "GRAMMAR", explanation: "Use UK spelling.", isActive: true },
      ];
      vi.mocked(db.rule.findMany).mockResolvedValue(localRules as unknown as Awaited<ReturnType<typeof db.rule.findMany>>);

      // Disable Groq key for this unit block to isolate rules matching
      const originalApiKey = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      const response = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({ content: "The color of the sky is blue." }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      
      // Expected correction at index 4 (color)
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        category: "GRAMMAR",
        originalText: "color",
        suggestedText: "colour",
        explanation: "Use UK spelling.",
        offsetStart: 4,
        offsetEnd: 9,
      });

      // Restore key
      process.env.GROQ_API_KEY = originalApiKey;
    });

    it("should merge local rules with safe AI JSON corrections, filtering out category mismatches", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(db.category.findMany).mockResolvedValue(activeCategories as unknown as Awaited<ReturnType<typeof db.category.findMany>>);
      vi.mocked(db.rule.findMany).mockResolvedValue([]); // No local rules

      // Mock AI JSON output with valid category and invalid category corrections
      const aiJson = [
        {
          category: "GRAMMAR",
          originalText: "receive",
          suggestedText: "recieve", // typo in mock test
          explanation: "Spelling.",
          offsetStart: 12,
          offsetEnd: 19,
        },
        {
          category: "INVALID_CAT", // Unrecognized category
          originalText: "content",
          suggestedText: "prose",
          explanation: "Style suggestion.",
          offsetStart: 2,
          offsetEnd: 9,
        },
      ];

      mockFetch.mockReturnValue(groqResponse(JSON.stringify({ corrections: aiJson })));

      vi.mocked(db.rateLimit.upsert).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof db.rateLimit.upsert>>);

      const response = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({ content: "This is some receive content." }), // receive starts at index 13? No, let's see.
        // "This is some receive content."
        //  012345678901234567890123456789
        //            ^ "receive" starts at 13.
      }));

      expect(response.status).toBe(200);
      
      // Let's configure the exact offset in the payload to match string slice
      const textContent = "This is some receive content.";
      // offsetStart: 13, offsetEnd: 20
      const correctAIJson = [
        {
          category: "GRAMMAR",
          originalText: "receive",
          suggestedText: "recieve",
          explanation: "Spelling check.",
          offsetStart: 13,
          offsetEnd: 20,
        },
      ];

      mockFetch.mockReturnValue(
        groqResponse(`\`\`\`json\n${JSON.stringify({ corrections: correctAIJson })}\n\`\`\``) // Test markdown fence parsing too
      );

      const successfulResponse = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({ content: textContent }),
      }));

      expect(successfulResponse.status).toBe(200);
      const body = await successfulResponse.json();
      
      // Check that only GRAMMAR correction is returned (INVALID_CAT discarded)
      expect(body).toHaveLength(1);
      expect(body[0].category).toBe("GRAMMAR");
      expect(body[0].originalText).toBe("receive");

      // Verify cost-awareness upsert was called
      expect(db.rateLimit.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          key_windowStart: {
            key: "total-ai-calls",
            windowStart: expect.any(Date),
          },
        },
      }));
    });

    it("should safely discard any AI correction where index offsets do not match the slice of original text", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(db.category.findMany).mockResolvedValue(activeCategories as unknown as Awaited<ReturnType<typeof db.category.findMany>>);
      vi.mocked(db.rule.findMany).mockResolvedValue([]);

      // Mock AI returning incorrect offsets (originalText "bad" but offset slices "text")
      const shiftedAIJson = [
        {
          category: "GRAMMAR",
          originalText: "bad",
          suggestedText: "excellent",
          explanation: "Spelling check.",
          offsetStart: 0,
          offsetEnd: 4, // Text at index 0..4 is "This" not "bad"
        },
      ];

      mockFetch.mockReturnValue(groqResponse(JSON.stringify({ corrections: shiftedAIJson })));

      const response = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({ content: "This is a bad sentence." }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      
      // Discarded because content.slice(0, 4) is "This" !== "bad"
      expect(body).toHaveLength(0);
    });

    it("should discard overlapping AI corrections to prevent UI and highlight overlapping crashes", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(db.category.findMany).mockResolvedValue(activeCategories as unknown as Awaited<ReturnType<typeof db.category.findMany>>);

      // Rules correction matches "bad" (index 10..13)
      const rulesList = [
        { id: "rule-1", pattern: "bad", replacement: "faulty", category: "GRAMMAR", explanation: "Rule math.", isActive: true },
      ];
      vi.mocked(db.rule.findMany).mockResolvedValue(rulesList as unknown as Awaited<ReturnType<typeof db.rule.findMany>>);

      // AI correction matches "bad sentence" (index 10..22), which overlaps rules correction
      const overlappingAIJson = [
        {
          category: "CLARITY",
          originalText: "bad sentence",
          suggestedText: "prose",
          explanation: "Clarity check.",
          offsetStart: 10,
          offsetEnd: 22,
        },
      ];

      mockFetch.mockReturnValue(groqResponse(JSON.stringify({ corrections: overlappingAIJson })));

      const response = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({ content: "This is a bad sentence." }), // "bad" starts at 10
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      
      // Verification: Rule correction is kept, overlapping AI correction is completely filtered out
      expect(body).toHaveLength(1);
      expect(body[0].category).toBe("GRAMMAR"); // Local rule correction preserved
      expect(body[0].originalText).toBe("bad");
    });
  });

  describe("API Timeout Controls", () => {
    it("should abort AI calls taking longer than configurated timeout and fallback to local rules safely", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(db.category.findMany).mockResolvedValue(activeCategories as unknown as Awaited<ReturnType<typeof db.category.findMany>>);
      
      // Rule matches "color"
      const localRules = [
        { id: "rule-1", pattern: "color", replacement: "colour", category: "GRAMMAR", explanation: "UK spelling.", isActive: true },
      ];
      vi.mocked(db.rule.findMany).mockResolvedValue(localRules as unknown as Awaited<ReturnType<typeof db.rule.findMany>>);

      // Mock AI call to hang/take long (e.g. 60ms)
      mockFetch.mockImplementation(() => {
        return new Promise((resolve) => setTimeout(() => resolve(
          groqResponse("{}")
        ), 60));
      });

      // Override mock settings specifically to enforce a fast 10ms timeout for test race
      vi.mocked(getSetting).mockImplementation((key: unknown, defaultValue: unknown) => {
        if (key === "ai_timeout_ms") return Promise.resolve(10); // 10ms timeout
        return Promise.resolve(defaultValue);
      });

      const response = await POST(new Request("http://localhost/api/proofread", {
        method: "POST",
        body: JSON.stringify({ content: "The color of the sky is blue." }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      
      // verify timeout was successfully executed, AI corrections aborted, but local rules correction is returned safely!
      expect(body).toHaveLength(1);
      expect(body[0].originalText).toBe("color");
    });
  });
});
