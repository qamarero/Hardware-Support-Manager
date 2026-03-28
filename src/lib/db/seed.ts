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
    .values([
      {
        name: "Administrador",
        email: "admin@hardware-support.local",
        passwordHash,
        role: "admin",
      },
      {
        name: "Domingo Bueno",
        email: "domingo.bueno@qamarero.com",
        passwordHash,
        role: "admin",
      },
    ])
    .onConflictDoNothing();

  console.log("Admin users created: admin@hardware-support.local, domingo.bueno@qamarero.com");

  // Seed providers
  const providerData = [
    {
      name: "GEON",
      email: "sat@g-on.es",
      contacts: [],
    },
    {
      name: "JASSWAY",
      email: "sat@jassway.es",
      rmaUrl: "soporte.jassway.net/tickets.php",
      contacts: [],
    },
    {
      name: "PC Mira",
      email: "sat@pcmira.com",
      rmaUrl: "pcmira.com/soporte/",
      contacts: [],
    },
    {
      name: "Posiflex",
      rmaUrl: "posiflex.es/sat?ini=rma",
      contacts: [],
    },
    {
      name: "Pedro Porto",
      contacts: [
        { name: "Soporte Tecnico ES", email: "tecnica.es@pedroporto.pt", role: "SAT" },
        { name: "Jose Romero", email: "jose.romero@pedroporto.pt", role: "Comercial" },
      ],
    },
    {
      name: "AQPROX",
      contacts: [
        { name: "Ana Zaragoza", email: "anazaragoza@mylar.es", role: "Comercial" },
        { name: "Fran y Sergio", email: "rma@mylar.es", phone: "954186767", role: "Tecnico" },
      ],
    },
  ];

  for (const p of providerData) {
    await db
      .insert(schema.providers)
      .values(p)
      .onConflictDoNothing();
  }

  console.log(`${providerData.length} providers seeded`);
  console.log("Seed completed!");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
