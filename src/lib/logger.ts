import { headers } from "next/headers";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  requestId?: string;
  stack?: string;
  [key: string]: unknown;
}

function shouldLog(level: LogLevel): boolean {
  const envLevel = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  return levels.indexOf(level) >= levels.indexOf(envLevel);
}

// Asynchronous wrapper to resolve standard Next.js forwarded headers safely
async function logAsync(
  level: LogLevel,
  context: string,
  message: string,
  metadata?: Record<string, unknown>,
  error?: unknown
) {
  let requestId: string | undefined;
  try {
    const headersList = await headers();
    requestId = headersList.get("x-request-id") || undefined;
  } catch {
    // Safe fallback: outside request contexts (e.g. CLI verify-prod, Vitest suite, boot phase)
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message: error instanceof Error ? error.message : (error !== undefined && error !== null ? String(error) : message),
    stack: error instanceof Error ? error.stack : undefined,
    requestId,
    ...metadata,
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "debug":
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}

function log(level: LogLevel, context: string, message: string, metadata?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  logAsync(level, context, message, metadata).catch(() => {});
}

export function logInfo(context: string, message: string, metadata?: Record<string, unknown>) {
  log("info", context, message, metadata);
}

export function logWarn(context: string, message: string, metadata?: Record<string, unknown>) {
  log("warn", context, message, metadata);
}

export function logError(context: string, error: unknown, metadata?: Record<string, unknown>) {
  if (!shouldLog("error")) return;
  logAsync("error", context, "", metadata, error).catch(() => {});
}

export function logDebug(context: string, message: string, metadata?: Record<string, unknown>) {
  log("debug", context, message, metadata);
}
