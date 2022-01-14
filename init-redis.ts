import * as redis from "redis";

export const client = redis.createClient({url: "redis://0.0.0.0:6379"});