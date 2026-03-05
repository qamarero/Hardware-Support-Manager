import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

async function seed() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 10);

  await db
    .insert(schema.users)
    .values({
      name: "Administrador",
      email: "admin@hardware-support.local",
      passwordHash,
      role: "admin",
    })
    .onConflictDoNothing();

  console.log("Admin user created: admin@hardware-support.local / admin123");
  console.log("Seed completed!");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
