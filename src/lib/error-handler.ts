import { Prisma } from "@prisma/client";
import { apiError } from "./api-response";
import { logError } from "./logger";

/**
 * Centrally maps unknown runtime and database errors into type-safe structured HTTP api responses.
 */
export function handleApiError(error: unknown, logContext: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiError(409, "Resource conflict: a record already exists with this unique identifier.");
    }
    if (error.code === "P2025") {
      return apiError(404, "Resource not found: the requested entity does not exist or has been deleted.");
    }
  }
  
  if (error instanceof SyntaxError) {
    return apiError(400, "Invalid JSON payload structure: please check your request format.");
  }
  
  if (error instanceof Error) {
    logError(logContext, error);
    return apiError(500, error.message || "Internal server error");
  }
  
  logError(logContext, new Error(String(error)));
  return apiError(500, "Internal server error");
}
