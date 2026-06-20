import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type DB = NeonHttpDatabase<typeof schema>;

let instance: DB | null = null;

function init(): DB {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  // Neon's HTTP driver is serverless/edge friendly — no pooling to manage.
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

/**
 * Lazily-initialized Drizzle client. Using a Proxy means importing this module
 * never touches `DATABASE_URL` (so `next build` can collect routes without it);
 * the connection is created on first query and throws clearly if unconfigured.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    if (!instance) instance = init();
    return Reflect.get(instance, prop, receiver);
  },
});

export { schema };
