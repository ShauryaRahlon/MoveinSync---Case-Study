import Redis from 'ioredis'

// Supports both local Redis and Upstash (cloud)
// Local: uses REDIS_HOST + REDIS_PORT
// Upstash: uses REDIS_URL (starts with rediss://)
const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)  // Upstash / cloud Redis
    : new Redis({                        // Local Redis
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        maxRetriesPerRequest: 3,
    });

redis.on('connect', () => {
    console.log("[Redis] Connected successfully")
})

redis.on('error', (err) => {
    console.log("[Redis] Connection error:", err.message)
})

export default redis;