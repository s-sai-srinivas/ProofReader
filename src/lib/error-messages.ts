export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Unauthorized access: please authenticate and try again.",
  FORBIDDEN: "Forbidden: you do not have sufficient permissions to access this resource.",
  INTERNAL_ERROR: "Internal server error: something went wrong on our side.",
  NOT_FOUND: "Resource not found: the requested entity could not be retrieved.",
  CONFLICT: "Resource already exists: unique constraint violation encountered.",
  BAD_REQUEST: "Bad request: invalid input payload structure.",
  RATE_LIMIT: "Too many requests: please slow down scanning attempts.",
} as const;
