import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * BullMQ needs its own connection per Queue/Worker and requires
 * maxRetriesPerRequest: null, or it throws on startup.
 */
export function createBullConnection() {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

/** Shared connection for LPUSH/EXPIRE caching and PUBLISH. */
export const redisCache = new Redis(REDIS_URL);

/**
 * Dedicated connection for subscribing. Once an ioredis client issues
 * SUBSCRIBE/PSUBSCRIBE it can't run normal commands anymore, so this
 * has to be separate from redisCache.
 */
export const redisSub = new Redis(REDIS_URL);

redisCache.on("error", (err) => console.error("[redis:cache] error", err));
redisSub.on("error", (err) => console.error("[redis:sub] error", err));