import { z } from "zod";
import { config } from "./config";
import { db } from "./db";

const PASSWORD_STRENGTH_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+={}[\]|:;"'<>,.?/~`]).+$/;

export const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(config.app.passwordMaxLength)
    .regex(
      PASSWORD_STRENGTH_REGEX,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  orgName: z.string().optional().nullable(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const DocumentSchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required").max(config.app.titleMaxLength),
  content: z.string().max(config.app.contentMaxLength, `Content exceeds ${config.app.contentMaxLength} characters`),
  originalContent: z.string().max(config.app.contentMaxLength).optional().nullable(),
  correctedContent: z.string().max(config.app.contentMaxLength).optional().nullable(),
  status: z.enum(["DRAFT", "IN_REVIEW", "COMPLETED", "ARCHIVED"]).optional().nullable(),
  version: z.number().int().nonnegative().optional().nullable(),
  corrections: z.array(
    z.object({
      id: z.string().optional().nullable(),
      category: z.string().min(1, "Category is required"),
      originalText: z.string(),
      suggestedText: z.string(),
      explanation: z.string(),
      offsetStart: z.number().int().nonnegative(),
      offsetEnd: z.number().int().nonnegative(),
    })
  ).optional().nullable(),
});

export const ProofreadSchema = z.object({
  content: z.string().min(1, "Content cannot be empty").max(config.app.contentMaxLength, `Content exceeds ${config.app.contentMaxLength} characters`),
});

export const RuleSchema = z.object({
  id: z.string().optional().nullable(),
  pattern: z.string().min(1, "Pattern is required").max(500),
  replacement: z.string().max(500),
  category: z.string().min(1, "Category is required"),
  explanation: z.string().min(1, "Explanation is required").max(1000),
  isActive: z.boolean().optional(),
});

export const RuleUpdateSchema = RuleSchema.partial();

export async function validateCategory(categoryName: string, orgId?: string | null): Promise<boolean> {
  const cleanName = categoryName.trim().toUpperCase();
  const category = await db.category.findFirst({
    where: {
      name: cleanName,
      isActive: true,
      OR: [
        { orgId: null },
        orgId ? { orgId } : {},
      ],
    },
  });
  return !!category;
}
