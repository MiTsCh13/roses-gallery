import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { testDatabaseUrl } from "./db-url";

// Creates the test database if missing and applies all migrations once per run.
export default async function setup() {
  const url = new URL(testDatabaseUrl());
  const name = url.pathname.slice(1);
  const admin = postgres(
    Object.assign(new URL(url), { pathname: "/postgres" }).toString(),
    { max: 1 },
  );
  const existing =
    await admin`select 1 from pg_database where datname = ${name}`;
  if (existing.length === 0) {
    await admin.unsafe(`create database "${name.replace(/"/g, "")}"`);
  }
  await admin.end();

  const client = postgres(url.toString(), { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}
