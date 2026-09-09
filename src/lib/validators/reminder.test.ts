import { describe, it, expect } from "vitest";
import { corkNoteSchema, updateCorkNoteSchema, createReminderSchema } from "./reminder";

const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const OTHER_UUID = "9c858901-8a57-4791-81fe-4c455b099bc9";

describe("corkNoteSchema", () => {
  it("accepts a bare note: just a title", () => {
    const r = corkNoteSchema.safeParse({ title: "Llamar al proveedor" });
    expect(r.success).toBe(true);
    if (r.success) {
      // Sin dueño = para todo el equipo; sin fecha = no vence.
      expect(r.data.userId).toBeUndefined();
      expect(r.data.dueAt).toBeUndefined();
      expect(r.data.color).toBe("amarillo");
    }
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(corkNoteSchema.safeParse({ title: "" }).success).toBe(false);
    expect(corkNoteSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("trims the title", () => {
    const r = corkNoteSchema.safeParse({ title: "  Revisar el RMA  " });
    expect(r.success && r.data.title).toBe("Revisar el RMA");
  });

  it("accepts a note addressed to a technician", () => {
    const r = corkNoteSchema.safeParse({ title: "Revisa esto", userId: UUID });
    expect(r.success && r.data.userId).toBe(UUID);
  });

  it("accepts an explicit null owner (note for the whole team)", () => {
    const r = corkNoteSchema.safeParse({ title: "Aviso general", userId: null });
    expect(r.success).toBe(true);
  });

  it("accepts a link to an incident or an RMA", () => {
    expect(corkNoteSchema.safeParse({ title: "x", entityType: "incident", entityId: UUID }).success).toBe(true);
    expect(corkNoteSchema.safeParse({ title: "x", entityType: "rma", entityId: UUID }).success).toBe(true);
  });

  it("rejects a link type without a target", () => {
    const r = corkNoteSchema.safeParse({ title: "x", entityType: "incident" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/incidencia o el RMA/i);
  });

  it("rejects an unknown link type", () => {
    expect(corkNoteSchema.safeParse({ title: "x", entityType: "asset", entityId: UUID }).success).toBe(false);
  });

  it("rejects a colour outside the palette", () => {
    expect(corkNoteSchema.safeParse({ title: "x", color: "fucsia" }).success).toBe(false);
    expect(corkNoteSchema.safeParse({ title: "x", color: "morado" }).success).toBe(true);
  });

  it("rejects a title over 500 chars and a body over 2000", () => {
    expect(corkNoteSchema.safeParse({ title: "a".repeat(501) }).success).toBe(false);
    expect(corkNoteSchema.safeParse({ title: "x", note: "a".repeat(2001) }).success).toBe(false);
  });

  it("coerces a date string into a Date", () => {
    const r = corkNoteSchema.safeParse({ title: "x", dueAt: "2026-09-15T09:00:00.000Z" });
    expect(r.success && r.data.dueAt instanceof Date).toBe(true);
  });

  it("rejects an invalid date", () => {
    expect(corkNoteSchema.safeParse({ title: "x", dueAt: "no soy una fecha" }).success).toBe(false);
  });
});

describe("updateCorkNoteSchema", () => {
  it("requires the note id on top of the note fields", () => {
    expect(updateCorkNoteSchema.safeParse({ title: "x" }).success).toBe(false);
    const r = updateCorkNoteSchema.safeParse({ id: OTHER_UUID, title: "x" });
    expect(r.success && r.data.id).toBe(OTHER_UUID);
  });

  it("still enforces the link rule", () => {
    expect(updateCorkNoteSchema.safeParse({ id: OTHER_UUID, title: "x", entityType: "rma" }).success).toBe(false);
  });
});

describe("createReminderSchema", () => {
  it("no longer requires a due date (a corkboard note has none)", () => {
    expect(createReminderSchema.safeParse({ title: "Seguimiento" }).success).toBe(true);
  });

  it("still validates the date when one is given", () => {
    expect(createReminderSchema.safeParse({ title: "x", dueAt: "vaya fecha" }).success).toBe(false);
    expect(createReminderSchema.safeParse({ title: "x", dueAt: "2026-09-15" }).success).toBe(true);
  });
});
