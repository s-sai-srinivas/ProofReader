import { db } from "./db";
import { logWarn } from "./logger";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

let cache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = Number(process.env.SETTINGS_CACHE_TTL_MS) || 30000;

const BYPASS_CACHE = process.env.NODE_ENV === "production" || process.env.BYPASS_SETTINGS_CACHE === "true";

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const now = Date.now();
  const cached = cache[key];
  if (!BYPASS_CACHE && cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  try {
    const setting = await db.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      if (!BYPASS_CACHE) {
        cache[key] = { value: defaultValue, expiresAt: now + CACHE_TTL_MS };
      }
      return defaultValue;
    }

    let parsedValue = setting.value;

    if (setting.type === "number") {
      parsedValue = Number(setting.value);
    } else if (setting.type === "boolean") {
      parsedValue = setting.value === "true" || setting.value === true;
    }

    if (!BYPASS_CACHE) {
      cache[key] = { value: parsedValue, expiresAt: now + CACHE_TTL_MS };
    }
    return parsedValue as unknown as T;
  } catch (error) {
    logWarn("SETTINGS_LOAD_FAILED", `Failed to load setting '${key}', using default`, { error: String(error) });

    const cachedFallback = BYPASS_CACHE ? undefined : cache[key];
    if (cachedFallback) {
      return cachedFallback.value as T;
    }

    return defaultValue;
  }
}

export function invalidateSettingsCache(key?: string) {
  if (key) {
    delete cache[key];
  } else {
    cache = {};
  }
}
