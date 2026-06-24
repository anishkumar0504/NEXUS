import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Main Redis client
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Cache-specific Redis client (can be same instance or separate)
export const redisCache = redis; // or new Redis(redisUrl, {...})

// Dedicated subscriber for pub/sub
export const redisSub = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (err: Error) => {
  console.error("Redis error:", err.message);
});

redisSub.on("error", (err: Error) => {
  console.error("RedisSub error:", err.message);
});

export function createBullConnection() {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}