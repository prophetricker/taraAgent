import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { readServerEnv } from "@/lib/env";

let sqlClient: postgres.Sql | null = null;

export function getSql() {
  if (!sqlClient) {
    sqlClient = postgres(readServerEnv().databaseUrl, {
      prepare: false,
      max: 5
    });
  }

  return sqlClient;
}

export function getDb() {
  return drizzle(getSql());
}
