import { describe, it, expect } from "vitest";
import { normalizarNombre } from "./cx-clients";

describe("normalizarNombre", () => {
  it("casa los nombres que solo difieren en un acento", () => {
    // Caso real: HSM lo tiene sin acento y CX Advisor con el.
    expect(normalizarNombre("La Bella Caffe Tejeringos"))
      .toBe(normalizarNombre("La Bella Caffé Tejeringos"));
  });

  it("casa los que solo difieren en mayusculas", () => {
    expect(normalizarNombre("La Esquina del Buen Sabor"))
      .toBe(normalizarNombre("La esquina del buen sabor"));
  });

  it("casa con y sin el prefijo CX - del CRM", () => {
    expect(normalizarNombre("CX - Green Planet")).toBe(normalizarNombre("Green Planet"));
  });

  it("ignora signos, apostrofes y espacios de mas", () => {
    expect(normalizarNombre("Bar L'encontre")).toBe(normalizarNombre("Bar L encontre"));
    expect(normalizarNombre("  Casa   de  Botes ")).toBe(normalizarNombre("Casa de Botes"));
  });

  it("NO casa restaurantes distintos", () => {
    expect(normalizarNombre("Bar La Plaza")).not.toBe(normalizarNombre("Bar La Plazuela"));
    expect(normalizarNombre("Canela en Rama")).not.toBe(normalizarNombre("Canela en Rama by Ana"));
  });
});
