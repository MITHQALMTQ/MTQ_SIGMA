// Task 16-b read-only DB probe. Never prints secret values — only basenames/counts.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const env = readFileSync("/home/z/my-project/.env", "utf8");
const m = env.match(/^DATABASE_URL=(.*)$/m);
const url = m[1].trim().replace(/^["']|["']$/g, "");
console.log("DATABASE_URL basename:", url.split("/").pop(), "| startsWith file:", url.startsWith("file:"));

const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const r = await c.execute("SELECT * FROM PilotTrial LIMIT 3");
console.log("PilotTrial rows via raw libsql:", r.rows.length);
console.log("row cols:", Object.keys(r.rows[0] ?? {}).join(","));
console.log("row sample:", JSON.stringify(r.rows[0] ?? {}).slice(0, 300));

// Now via the app's Prisma client (same constructor path as src/lib/db.ts)
const { PrismaClient } = await import("@prisma/client");
const pc = new PrismaClient({ log: ["error"], datasources: { db: { url } } });
const trials = await pc.pilotTrial.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
console.log("PilotTrial rows via Prisma (app path):", trials.length);
if (trials.length > 0) console.log("prisma first row:", JSON.stringify(trials[0]).slice(0, 250));
await pc.$disconnect();
