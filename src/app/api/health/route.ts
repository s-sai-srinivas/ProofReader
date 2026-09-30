import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import packageJson from "@/../package.json";

export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "ok" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: "ok" | "error"; latencyMs: number };
    gemini: { status: "ok" | "error"; configured: boolean };
  };
}

export async function GET() {
  const start = Date.now();

  const result: HealthStatus = {
    status: "ok",
    version: packageJson.version || "0.1.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: "ok", latencyMs: 0 },
      gemini: { status: "ok", configured: true },
    },
  };

  let allHealthy = true;

  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    result.checks.database.latencyMs = Date.now() - dbStart;
    result.checks.database.status = "ok";
  } catch {
    result.checks.database.status = "error";
    result.checks.database.latencyMs = Date.now() - start;
    allHealthy = false;
  }

  try {
    const geminiKey = config.gemini.apiKey;
    result.checks.gemini.configured = !!geminiKey && geminiKey.length > 10;
    result.checks.gemini.status = result.checks.gemini.configured ? "ok" : "error";
    if (!result.checks.gemini.configured) allHealthy = false;
  } catch {
    result.checks.gemini.configured = false;
    result.checks.gemini.status = "error";
    allHealthy = false;
  }

  result.status = allHealthy ? "ok" : "degraded";

  const statusCode = allHealthy ? 200 : 503;
  return NextResponse.json(result, { status: statusCode });
}
