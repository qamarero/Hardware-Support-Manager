/**
 * Robust extraction helpers for Intercom `ticket_attributes` / `custom_attributes`.
 *
 * Intercom returns custom field keys exactly as the workspace admin typed
 * them — including trailing colons, accidental BOM (U+FEFF) prefixes from
 * copy-paste, case variations, and odd whitespace. Hardcoded lookups
 * (e.g. `attrs["Resumen del problema del cliente:"]`) are fragile because
 * a single character difference makes the lookup silently fail.
 *
 * Strategy:
 *   1. Normalize the keys of the raw attribute object once (BOM stripped,
 *      trailing punctuation removed, trimmed, lowercased).
 *   2. Provide a `getAttr()` lookup that normalizes each candidate key and
 *      returns the first matching value as a trimmed string (or null).
 *
 * Caller passes multiple candidate keys to tolerate naming variations
 * (e.g. "resumen del problema del cliente" vs "resumen problema cliente").
 */

// Zero-width characters that Intercom keys may contain after copy-paste:
// U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+FEFF (BOM).
// Built via String.fromCharCode so the source file stays free of
// invisible characters (which would otherwise be impossible to spot).
const ZERO_WIDTH_RE = new RegExp(
  `[${String.fromCharCode(0x200b, 0x200c, 0x200d, 0xfeff)}]`,
  "g",
);

/** Strip zero-width chars, trailing punctuation, trim, lowercase. */
export function normalizeTicketAttrKey(key: string): string {
  return key
    .replace(ZERO_WIDTH_RE, "")
    .replace(/[\s:.*]+$/, "")
    .trim()
    .toLowerCase();
}

/**
 * Build a normalized key → value map from a raw attributes object.
 * Values that are not primitive strings are coerced via `String(...)`.
 * Empty strings remain (so callers can distinguish "present but empty"
 * from "absent" if they choose to).
 */
export function buildAttrsMap(
  raw: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    const normKey = normalizeTicketAttrKey(k);
    if (!normKey) continue; // skip empty keys after normalization
    const strVal = typeof v === "string" ? v : String(v);
    out[normKey] = strVal;
  }
  return out;
}

/**
 * Tolerant lookup: returns the value of the first candidate key that
 * matches, normalized; trims surrounding whitespace; returns `null` when
 * no candidate produces a non-empty value.
 *
 * Example:
 *   const map = buildAttrsMap(item.ticket_attributes);
 *   const problem = getAttr(map, "resumen del problema del cliente", "resumen problema cliente");
 */
export function getAttr(
  normalizedMap: Record<string, string>,
  ...candidates: string[]
): string | null {
  for (const candidate of candidates) {
    const normCandidate = normalizeTicketAttrKey(candidate);
    if (!normCandidate) continue;
    const value = normalizedMap[normCandidate];
    if (value != null) {
      const trimmed = value.trim();
      if (trimmed !== "") return trimmed;
    }
  }
  return null;
}
