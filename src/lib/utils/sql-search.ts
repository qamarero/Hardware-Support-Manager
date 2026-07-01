import { sql, type SQL, type AnyColumn } from "drizzle-orm";

/**
 * SQL fragment for accent + case insensitive ILIKE.
 *
 * Postgres' `unaccent()` extension is not available via the Supabase pooler
 * (see CLAUDE.md / fix commit `8ff3bc3`), so we emulate it with `translate()`
 * — a built-in that maps each source character to a destination character
 * 1:1. Combined with `lower()`, this yields case + diacritic insensitive
 * lookup without any extension.
 *
 * Mapping covers Spanish/Catalan/Portuguese accents and uppercase variants.
 *
 * Caller must pass an already-normalized `term` (lowercase, no diacritics);
 * use `normalizeSearchInput` from search-normalize.ts before calling.
 */
const FROM_CHARS = "áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöÄËÏÖãõÃÕçÇ";
const TO_CHARS   = "aeiouunAEIOUUNaeiouAEIOUaeiouAEIOUaeioAEIOaoAOcC";

export function accentInsensitiveLike(
  column: AnyColumn | SQL,
  normalizedTerm: string,
): SQL {
  const pattern = `%${normalizedTerm}%`;
  return sql`lower(translate(${column}, ${FROM_CHARS}, ${TO_CHARS})) ILIKE ${pattern}`;
}

/**
 * Builds ONE normalized text expression from several columns:
 * `lower(translate(concat_ws(' ', col1, col2, …), …))`. `concat_ws` ignores
 * NULLs. Used as the haystack for trigram fuzzy matching below.
 */
export function accentNormalizedConcat(columns: (AnyColumn | SQL)[]): SQL {
  const list = sql.join(
    columns.map((c) => sql`${c}`),
    sql`, `,
  );
  return sql`lower(translate(concat_ws(' ', ${list}), ${FROM_CHARS}, ${TO_CHARS}))`;
}

/**
 * Trigram fuzzy match (pg_trgm `word_similarity`): true when `normalizedTerm`
 * is similar enough to some word in the (already normalized) haystack. This is
 * what tolerates typos like "txoco" → "Txoko".
 *
 * pg_trgm is installed and reachable via the Supabase pooler (the `hsm_app`
 * role's search_path includes `public`), unlike `unaccent`. On real data a
 * 1-char typo scores ~0.5 while unrelated rows score ≤0.17, so the default
 * threshold 0.4 separates them cleanly.
 */
export function fuzzyWordMatch(
  normalizedHaystack: SQL,
  normalizedTerm: string,
  threshold = 0.4,
): SQL {
  return sql`word_similarity(${normalizedTerm}, ${normalizedHaystack}) >= ${threshold}`;
}

/** Relevance score for ORDER BY: best word_similarity across all tokens. */
export function relevanceScore(normalizedHaystack: SQL, tokens: string[]): SQL {
  const sims = sql.join(
    tokens.map((t) => sql`word_similarity(${t}, ${normalizedHaystack})`),
    sql`, `,
  );
  return sql`greatest(${sims}, 0)`;
}
