import { describe, it, expect } from "vitest";
import { getRmaAvailableTransitions, isValidRmaTransition, RMA_TRANSITIONS } from "./rma";

describe("RMA State Machine", () => {
  describe("getRmaAvailableTransitions", () => {
    it("returns transitions from 'borrador' for technician", () => {
      const transitions = getRmaAvailableTransitions("borrador", "technician");
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions.every((t) => t.from === "borrador")).toBe(true);
    });

    it("returns no transitions from terminal states", () => {
      const fromCerrado = getRmaAvailableTransitions("cerrado", "admin");
      const fromCancelado = getRmaAvailableTransitions("cancelado", "admin");
      expect(fromCerrado).toHaveLength(0);
      expect(fromCancelado).toHaveLength(0);
    });

    it("viewer has no transitions available", () => {
      const transitions = getRmaAvailableTransitions("borrador", "viewer");
      expect(transitions).toHaveLength(0);
    });

    it("follows linear flow from borrador to cerrado", () => {
      const expectedFlow = [
        ["borrador", "solicitado"],
        ["solicitado", "aprobado"],
        ["aprobado", "enviado_proveedor"],
        ["enviado_proveedor", "en_proveedor"],
        ["en_proveedor", "devuelto"],
        ["devuelto", "recibido_oficina"],
        // El equipo se entrega al cliente antes de cerrar el RMA: no hay salto
        // directo de "recibido_oficina" a "cerrado".
        ["recibido_oficina", "entregado_cliente"],
        ["entregado_cliente", "cerrado"],
      ] as const;
      for (const [from, to] of expectedFlow) {
        expect(isValidRmaTransition(from, to, "technician")).toBe(true);
      }
    });
  });

  describe("isValidRmaTransition", () => {
    it("accepts valid transition", () => {
      expect(isValidRmaTransition("borrador", "solicitado", "technician")).toBe(true);
    });

    it("rejects invalid transition", () => {
      expect(isValidRmaTransition("borrador", "cerrado", "admin")).toBe(false);
    });

    it("rejects transition for insufficient role", () => {
      expect(isValidRmaTransition("borrador", "solicitado", "viewer")).toBe(false);
    });
  });

  describe("transition definitions", () => {
    it("all transitions have labels in Spanish", () => {
      for (const t of RMA_TRANSITIONS) {
        expect(t.label.length).toBeGreaterThan(0);
      }
    });

    it("all transitions have at least one required role", () => {
      for (const t of RMA_TRANSITIONS) {
        expect(t.requiredRole.length).toBeGreaterThan(0);
      }
    });
  });
});
