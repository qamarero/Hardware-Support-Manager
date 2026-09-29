import { describe, it, expect } from "vitest";
import { cleanLocationName } from "./cx-advisor";

describe("cleanLocationName", () => {
  it("quita el prefijo «CX - » que pone HubSpot", () => {
    expect(cleanLocationName("CX - Green Planet")).toBe("Green Planet");
  });

  it("acepta guion normal, medio y largo", () => {
    expect(cleanLocationName("CX - Bar Paco")).toBe("Bar Paco");
    expect(cleanLocationName("CX – Bar Paco")).toBe("Bar Paco");
    expect(cleanLocationName("CX — Bar Paco")).toBe("Bar Paco");
  });

  it("no distingue mayúsculas ni se traba con los espacios", () => {
    expect(cleanLocationName("cx -Bar Paco")).toBe("Bar Paco");
    expect(cleanLocationName("  CX   -   Bar Paco  ")).toBe("Bar Paco");
  });

  it("deja intacto un nombre sin prefijo", () => {
    expect(cleanLocationName("Green Planet")).toBe("Green Planet");
    expect(cleanLocationName("Knela Cafe")).toBe("Knela Cafe");
  });

  it("no se come un nombre que empieza por CX sin ser el prefijo", () => {
    expect(cleanLocationName("CXO Lounge")).toBe("CXO Lounge");
    expect(cleanLocationName("CX Burger")).toBe("CX Burger");
  });

  it("si el nombre es solo el prefijo, devuelve el original en vez de vacío", () => {
    // Un cliente sin nombre rompería el buscador; mejor un nombre raro que nada.
    expect(cleanLocationName("CX - ")).toBe("CX -");
  });
});
