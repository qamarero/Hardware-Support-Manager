import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function migrate() {
  console.log("Adding client_code column to hsm.clients...");

  await sql`
    ALTER TABLE hsm.clients
    ADD COLUMN IF NOT EXISTS client_code varchar(50);
  `;

  await sql`
    ALTER TABLE hsm.clients
    ADD CONSTRAINT clients_client_code_unique UNIQUE (client_code);
  `;

  console.log("Done.");
  await sql.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
