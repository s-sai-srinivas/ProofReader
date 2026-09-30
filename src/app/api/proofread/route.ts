import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProofreadSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logError } from "@/lib/logger";
import { isRateLimited } from "@/lib/rateLimit";
import { config } from "@/lib/config";
import { getSetting } from "@/lib/settings";
import { handleApiError } from "@/lib/error-handler";
import { sanitizeText } from "@/lib/sanitize";

interface TextCorrection {
  category: "GRAMMAR" | "CLARITY" | "TONE" | "STYLE";
  originalText: string;
  suggestedText: string;
  explanation: string;
  offsetStart: number;
  offsetEnd: number;
}

interface AICorrection {
  category: string;
  originalText: string;
  suggestedText: string;
  explanation: string;
  offsetStart: number;
  offsetEnd: number;
}

function parseGeminiJson(text: string): AICorrection[] {
  let cleaned = text.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned) as AICorrection[];
  } catch (firstErr) {
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as AICorrection[];
      } catch (fallbackErr) {
        logError("GEMINI_JSON_FALLBACK_PARSE_FAILED", fallbackErr, {
          snippet: text.slice(0, 500),
        });
        throw fallbackErr;
      }
    }

    logError("GEMINI_JSON_PARSE_FAILED", firstErr, {
      snippet: text.slice(0, 500),
    });
    throw firstErr;
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return apiError(401, "Unauthorized");
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "Invalid JSON payload");
    }

    const validation = ProofreadSchema.safeParse(body);
    if (!validation.success) {
      return apiError(400, "Validation failed", validation.error.format());
    }

    const { content } = validation.data;
    const sanitizedContent = sanitizeText(content);

    const limit = await getSetting("rate_limit_proofread_limit", config.rateLimit.proofread.limit);
    const windowMs = config.rateLimit.proofread.windowMs;
    if (await isRateLimited(`proofread-${user.id}`, limit, windowMs)) {
      return apiError(429, `Too many proofreading scans. Please try again after ${windowMs / 1000} seconds.`);
    }

    const corrections: TextCorrection[] = [];

    const activeCategories = await db.category.findMany({
      where: {
        isActive: true,
        OR: [
          { orgId: null },
          { orgId: user.orgId },
        ],
      },
      orderBy: { sortOrder: "asc" },
    });
    const activeCategoryNames = activeCategories.map((c) => c.name.toUpperCase());

    const activeRules = await db.rule.findMany({
      where: {
        isActive: true,
        orgId: user.orgId,
      },
    });

    for (const rule of activeRules) {
      if (!activeCategoryNames.includes(rule.category.toUpperCase())) continue;
      const pattern = rule.pattern;
      if (!pattern) continue;

      let index = 0;
      const lowerContent = content.toLowerCase();
      const lowerPattern = pattern.toLowerCase();

      while (true) {
        index = lowerContent.indexOf(lowerPattern, index);
        if (index === -1) break;

        const originalText = content.slice(index, index + pattern.length);

        let suggestedText = rule.replacement;
        if (originalText.length > 0) {
          if (originalText === originalText.toUpperCase() && originalText !== originalText.toLowerCase()) {
            suggestedText = suggestedText.toUpperCase();
          } else if (originalText[0] === originalText[0].toUpperCase()) {
            suggestedText = suggestedText.charAt(0).toUpperCase() + suggestedText.slice(1);
          }
        }

        corrections.push({
          category: rule.category as TextCorrection["category"],
          originalText,
          suggestedText,
          explanation: rule.explanation,
          offsetStart: index,
          offsetEnd: index + pattern.length,
        });

        index += pattern.length;
      }
    }

    const apiKey = config.gemini.apiKey;
    if (apiKey) {
      try {
        const activeModelName = await getSetting("gemini_model", config.gemini.model);
        const timeoutMs = await getSetting("gemini_timeout_ms", config.gemini.timeoutMs);

        const safeContent = sanitizedContent
          .replace(/---BEGIN USER CONTENT---/g, "[DELIMITER_BLOCKED]")
          .replace(/---END USER CONTENT---/g, "[DELIMITER_BLOCKED]");

        const systemInstruction = `You are an expert AI proofreader. Scan the text for spelling, grammar, clarity, style, and tone errors. Provide appropriate corrections and explain why the changes are helpful.

Return a JSON array of objects. Each correction object MUST have precisely this structure:
{
  "category": ${activeCategoryNames.length > 0 ? activeCategoryNames.map((name) => `"${name}"`).join(" | ") : '"GRAMMAR" | "CLARITY" | "TONE" | "STYLE"'},
  "originalText": string (the exact text in the original document to replace),
  "suggestedText": string (the proposed replacement),
  "explanation": string (short description of why this change is suggested),
  "offsetStart": number (the 0-indexed character start index in the original text where originalText resides),
  "offsetEnd": number (the 0-indexed character end index in the original text where originalText ends)
}

Important Rules:
- Ensure "offsetStart" and "offsetEnd" are mathematically correct relative to the original text.
- If no corrections are needed, return an empty array [].
- Return ONLY the raw JSON array.`;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: activeModelName,
          systemInstruction,
          generationConfig: {
            responseMimeType: "application/json",
          },
        });

        const prompt = `---BEGIN USER CONTENT---
${safeContent}
---END USER CONTENT---`;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI proofreading request timed out after ${timeoutMs / 1000} seconds`)), timeoutMs)
        );

        const result = await Promise.race([
          model.generateContent(prompt),
          timeoutPromise
        ]);

        await db.rateLimit.upsert({
          where: {
            key_windowStart: {
              key: "total-gemini-calls",
              windowStart: new Date(0),
            },
          },
          update: {
            count: { increment: 1 },
          },
          create: {
            key: "total-gemini-calls",
            windowStart: new Date(0),
            count: 1,
          },
        }).catch(err => logError("COST_AWARENESS_LOG_FAILED", err));

        const responseText = result.response.text();

        if (responseText) {
          let aiCorrections: AICorrection[] = [];
          try {
            aiCorrections = parseGeminiJson(responseText);
          } catch (parseErr) {
            logError("API_PROOFREAD_AI_PARSE_FAILED", parseErr, { responseText });
          }

          if (Array.isArray(aiCorrections)) {
            aiCorrections.forEach((c) => {
              const cleanCategory = c.category?.trim().toUpperCase();
              if (
                cleanCategory &&
                typeof c.category === "string" &&
                activeCategoryNames.includes(cleanCategory) &&
                c.originalText &&
                c.suggestedText !== undefined &&
                c.explanation &&
                typeof c.offsetStart === "number" &&
                typeof c.offsetEnd === "number" &&
                c.offsetStart >= 0 &&
                c.offsetEnd > c.offsetStart
              ) {
                const actualText = content.slice(c.offsetStart, c.offsetEnd);
                if (actualText === c.originalText) {
                  const isOverlapping = corrections.some(
                    (existing) =>
                      (c.offsetStart >= existing.offsetStart && c.offsetStart < existing.offsetEnd) ||
                      (c.offsetEnd > existing.offsetStart && c.offsetEnd <= existing.offsetEnd)
                  );

                  if (!isOverlapping) {
                    corrections.push({
                      category: cleanCategory as TextCorrection["category"],
                      originalText: c.originalText,
                      suggestedText: c.suggestedText,
                      explanation: c.explanation,
                      offsetStart: c.offsetStart,
                      offsetEnd: c.offsetEnd,
                    });
                  }
                }
              }
            });
          }
        }
      } catch (aiError) {
        logError("API_PROOFREAD_AI_SCANNER", aiError);
      }
    }

    corrections.sort((a, b) => a.offsetStart - b.offsetStart);

    return apiSuccess(corrections);
  } catch (error) {
    return handleApiError(error, "API_PROOFREAD_POST");
  }
}
