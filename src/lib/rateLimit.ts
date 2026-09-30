import { db } from "./db";
import { logError } from "./logger";

const fallbackCounts = new Map<string, { count: number; windowStart: number }>();

export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();

  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  try {
    const record = await db.rateLimit.upsert({
      where: {
        key_windowStart: {
          key,
          windowStart,
        },
      },
      update: {
        count: {
          increment: 1,
        },
      },
      create: {
        key,
        windowStart,
        count: 1,
      },
    });

    if (record.count > limit) {
      return true;
    }

    if (Math.random() < 0.01) {
      const cleanOlderThan = new Date(now.getTime() - 2 * windowMs);
      await db.rateLimit.deleteMany({
        where: {
          windowStart: {
            lt: cleanOlderThan,
          },
        },
      }).catch((err) => logError("RATE_LIMIT_CLEANUP", err));
    }

    return false;
  } catch (error) {
    logError("RATE_LIMITING_DB_FALLBACK", error);

    const fallbackKey = `${key}:${windowStart.getTime()}`;
    const existing = fallbackCounts.get(fallbackKey);
    const count = existing ? existing.count + 1 : 1;
    fallbackCounts.set(fallbackKey, { count, windowStart: windowStart.getTime() });

    if (count > limit) {
      return true;
    }

    return false;
  }
}
