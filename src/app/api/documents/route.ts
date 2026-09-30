import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DocumentSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/api-response";
import { DocumentStatus } from "@prisma/client";
import { handleApiError } from "@/lib/error-handler";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return apiError(401, "Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return apiError(400, "Document ID required");
  }

  try {
    const document = await db.document.findFirst({
      where: { id, ownerId: user.id, orgId: user.orgId },
      include: { corrections: true },
    });

    if (!document) {
      return apiError(404, "Document not found");
    }

    return apiSuccess(document);
  } catch (error) {
    return handleApiError(error, "API_DOCUMENTS_GET");
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

    const validation = DocumentSchema.safeParse(body);
    if (!validation.success) {
      return apiError(400, "Validation failed", validation.error.format());
    }

    const { id, title, content, originalContent, correctedContent, status, corrections, version } = validation.data;

    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

    let document;

    interface InputCorrection {
      category: string;
      originalText: string;
      suggestedText: string;
      explanation: string;
      offsetStart: number;
      offsetEnd: number;
    }

    if (id) {
      // Concurrency check: retrieve existing document and verify version
      const existingDoc = await db.document.findFirst({
        where: { id, ownerId: user.id, orgId: user.orgId },
      });

      if (!existingDoc) {
        return apiError(404, "Document not found");
      }

      if (version === undefined || version === null || existingDoc.version !== version) {
        return apiError(409, "Conflict: This document has been modified by another session. Please reload to avoid overwriting changes.", {
          currentVersion: existingDoc.version,
          submittedVersion: version,
        });
      }

      // Execute document update AND corrections replacement in a single atomic transaction
      document = await db.$transaction(async (tx) => {
        // Update document using only the unique primary key constraint (id)
        const updatedDoc = await tx.document.update({
          where: { id },
          data: {
            title,
            originalContent: originalContent || content,
            correctedContent: correctedContent || null,
            wordCount,
            status: (status as DocumentStatus) || DocumentStatus.DRAFT,
            version: { increment: 1 },
          },
        });

        // If corrections are provided, validate and update them
        if (corrections && Array.isArray(corrections)) {
          const activeCategories = await tx.category.findMany({
            where: {
              isActive: true,
              OR: [
                { orgId: null },
                { orgId: user.orgId },
              ],
            },
          });
          const activeCategoryNames = activeCategories.map((c) => c.name.toUpperCase());
          const docLength = (originalContent || content).length;

          const validCorrections = (corrections as InputCorrection[])
            .filter((c) => {
              const cleanCategory = c.category?.trim().toUpperCase();
              return (
                cleanCategory &&
                activeCategoryNames.includes(cleanCategory) &&
                typeof c.offsetStart === "number" &&
                typeof c.offsetEnd === "number" &&
                c.offsetStart >= 0 &&
                c.offsetEnd <= docLength &&
                c.offsetStart <= c.offsetEnd &&
                typeof c.originalText === "string" &&
                typeof c.suggestedText === "string" &&
                typeof c.explanation === "string"
              );
            })
            .map((c) => {
              const cleanCategory = c.category.trim().toUpperCase();
              const matchedCategory = activeCategories.find((cat) => cat.name === cleanCategory);
              return {
                documentId: id,
                category: cleanCategory,
                categoryId: matchedCategory ? matchedCategory.id : null,
                originalText: c.originalText,
                suggestedText: c.suggestedText,
                explanation: c.explanation,
                offsetStart: c.offsetStart,
                offsetEnd: c.offsetEnd,
              };
            });

          // Clear old corrections safely scoped to this document ID
          await tx.correction.deleteMany({
            where: {
              documentId: id,
            },
          });

          // Insert new ones
          if (validCorrections.length > 0) {
            await tx.correction.createMany({
              data: validCorrections,
            });
          }
        }

        return updatedDoc;
      });
    } else {
      // Create new document with active user's orgId
      document = await db.document.create({
        data: {
          title,
          originalContent: content,
          wordCount,
          ownerId: user.id,
          orgId: user.orgId,
          status: DocumentStatus.DRAFT,
        },
      });
    }

    return apiSuccess(document);
  } catch (error) {
    return handleApiError(error, "API_DOCUMENTS_POST");
  }
}

