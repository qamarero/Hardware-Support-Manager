import { describe, it, expect } from "vitest";
import { getAvailableTransitions, isValidTransition, INCIDENT_TRANSITIONS } from "./incident";

describe("Incident State Machine", () => {
  describe("getAvailableTransitions", () => {
    it("returns transitions from 'nuevo' for technician", () => {
      const transitions = getAvailableTransitions("nuevo", "technician");
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions.every((t) => t.from === "nuevo")).toBe(true);
    });

    it("returns no transitions from terminal states", () => {
      const fromCerrado = getAvailableTransitions("cerrado", "admin");
      const fromCancelado = getAvailableTransitions("cancelado", "admin");
      expect(fromCerrado).toHaveLength(0);
      expect(fromCancelado).toHaveLength(0);
    });

    it("viewer has no transitions available", () => {
      const transitions = getAvailableTransitions("nuevo", "viewer");
      expect(transitions).toHaveLength(0);
    });

    // "en_triaje" se conserva en INCIDENT_STATUSES por incidencias antiguas, pero ya no
    // tiene transiciones definidas: el flujo actual va de "nuevo" directo a "en_gestion".
    it("admin can cancel from most states", () => {
      const statesWithCancel = ["nuevo", "en_gestion", "esperando_cliente", "esperando_proveedor", "esperando_pieza"] as const;
      for (const state of statesWithCancel) {
        const transitions = getAvailableTransitions(state, "admin");
        expect(transitions.some((t) => t.to === "cancelado")).toBe(true);
      }
    });

    it("admin can reopen from resuelto", () => {
      const transitions = getAvailableTransitions("resuelto", "admin");
      expect(transitions.some((t) => t.to === "en_gestion")).toBe(true);
    });

    it("technician cannot reopen from resuelto", () => {
      const transitions = getAvailableTransitions("resuelto", "technician");
      expect(transitions.some((t) => t.to === "en_gestion")).toBe(false);
    });
  });

  describe("isValidTransition", () => {
    it("accepts valid transition", () => {
      expect(isValidTransition("nuevo", "en_gestion", "technician")).toBe(true);
    });

    it("rejects invalid transition", () => {
      expect(isValidTransition("nuevo", "cerrado", "admin")).toBe(false);
    });

    it("rejects transition for insufficient role", () => {
      expect(isValidTransition("nuevo", "en_triaje", "viewer")).toBe(false);
    });

    it("rejects skipping states", () => {
      expect(isValidTransition("nuevo", "resuelto", "admin")).toBe(false);
    });
  });

  describe("transition definitions", () => {
    it("all transitions have labels in Spanish", () => {
      for (const t of INCIDENT_TRANSITIONS) {
        expect(t.label.length).toBeGreaterThan(0);
      }
    });

    it("all transitions have at least one required role", () => {
      for (const t of INCIDENT_TRANSITIONS) {
        expect(t.requiredRole.length).toBeGreaterThan(0);
      }
    });
  });
});
