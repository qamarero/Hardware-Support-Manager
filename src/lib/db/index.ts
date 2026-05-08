import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;

export function getDb() {
  if (!_db) {
    const client = postgres(process.env.DATABASE_URL!, {
      prepare: false,       // Required for Supabase Supavisor (transaction mode)
      // 20 concurrent client-side connections. The dashboard SSR fires up to 4
      // queries in parallel, and /api/external/metrics fires 11. Con max:6 una
      // sola request consumía todo el pool y los siguientes esperaban hasta
      // que liberaran, generando >30s percibidos. Supavisor multiplexa por
      // detrás, así que subir aquí es seguro.
      max: 20,
      idle_timeout: 60,     // Release idle connections after 60s
      connect_timeout: 10,  // Fail fast on connection issues
      connection: {
        statement_timeout: 15000,  // 15s max per statement — prevents queries from hanging
      },
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

// Lazy singleton via Proxy — defers getDb() until first property access,
// so DATABASE_URL doesn't need to be available at module import time.
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
