import { db } from "@/lib/db";
import { sequences } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function generateSequentialId(prefix: "INC" | "RMA" | "EQ"): Promise<string> {
  const year = new Date().getFullYear();

  const result = await db
    .insert(sequences)
    .values({ prefix, year, lastValue: 1 })
    .onConflictDoUpdate({
      target: [sequences.prefix, sequences.year],
      set: { lastValue: sql`${sequences.lastValue} + 1` },
    })
    .returning({ lastValue: sequences.lastValue });

  const seqNumber = result[0].lastValue;
  const paddedNumber = String(seqNumber).padStart(5, "0");

  return `${prefix}-${year}-${paddedNumber}`;
}
