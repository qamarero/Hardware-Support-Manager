import { describe, it, expect } from "vitest";
import {
  normalizeTicketAttrKey,
  buildAttrsMap,
  getAttr,
} from "./ticket-attrs";

const BOM = "﻿";
const ZWSP = "​";

describe("normalizeTicketAttrKey", () => {
  it("strips BOM prefix", () => {
    expect(normalizeTicketAttrKey(`${BOM}Resumen del problema:`)).toBe(
      "resumen del problema",
    );
  });

  it("strips BOM anywhere in the string", () => {
    expect(normalizeTicketAttrKey(`Resumen${BOM} del problema:`)).toBe(
      "resumen del problema",
    );
  });

  it("strips zero-width space", () => {
    expect(normalizeTicketAttrKey(`Resumen${ZWSP} del problema`)).toBe(
      "resumen del problema",
    );
  });

  it("drops trailing colon", () => {
    expect(normalizeTicketAttrKey("Resumen del problema:")).toBe(
      "resumen del problema",
    );
  });

  it("drops trailing period and spaces", () => {
    expect(normalizeTicketAttrKey("Resumen del problema . ")).toBe(
      "resumen del problema",
    );
  });

  it("lowercases", () => {
    expect(normalizeTicketAttrKey("RESUMEN del PROBLEMA")).toBe(
      "resumen del problema",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeTicketAttrKey("  Resumen del problema  ")).toBe(
      "resumen del problema",
    );
  });

  it("returns empty for empty input", () => {
    expect(normalizeTicketAttrKey("")).toBe("");
  });

  it("returns empty when only zero-width chars and punctuation", () => {
    expect(normalizeTicketAttrKey(`${BOM}: `)).toBe("");
  });
});

describe("buildAttrsMap", () => {
  it("normalizes keys and keeps values", () => {
    const raw = {
      [`${BOM}Resumen del problema del cliente:`]: "TPV roto",
      "Pasos realizados de troubleshooting:": "Reiniciado",
      Urgencia: "alta",
    };
    const map = buildAttrsMap(raw);
    expect(map).toEqual({
      "resumen del problema del cliente": "TPV roto",
      "pasos realizados de troubleshooting": "Reiniciado",
      urgencia: "alta",
    });
  });

  it("coerces non-string values to strings", () => {
    const map = buildAttrsMap({ urgencia: 5 });
    expect(map.urgencia).toBe("5");
  });

  it("skips null and undefined values", () => {
    const map = buildAttrsMap({ a: null, b: undefined, c: "x" });
    expect(map).toEqual({ c: "x" });
  });

  it("returns empty object for null input", () => {
    expect(buildAttrsMap(null)).toEqual({});
  });

  it("returns empty object for undefined input", () => {
    expect(buildAttrsMap(undefined)).toEqual({});
  });
});

describe("getAttr", () => {
  const map = {
    "resumen del problema del cliente": "TPV roto",
    "pasos realizados de troubleshooting": "Reiniciado",
    urgencia: "alta",
    "campo vacio": "  ",
  };

  it("finds exact normalized match", () => {
    expect(getAttr(map, "resumen del problema del cliente")).toBe("TPV roto");
  });

  it("tolerates BOM in candidate", () => {
    expect(getAttr(map, `${BOM}Resumen del problema del cliente:`)).toBe(
      "TPV roto",
    );
  });

  it("tolerates trailing colon in candidate", () => {
    expect(getAttr(map, "Resumen del problema del cliente:")).toBe("TPV roto");
  });

  it("returns first match among candidates", () => {
    expect(
      getAttr(map, "nonexistent key", "Urgencia", "Resumen del problema"),
    ).toBe("alta");
  });

  it("trims the returned value", () => {
    const m = { foo: "  hello  " };
    expect(getAttr(m, "foo")).toBe("hello");
  });

  it("returns null when value is whitespace only", () => {
    expect(getAttr(map, "campo vacio")).toBeNull();
  });

  it("returns null when no candidate matches", () => {
    expect(getAttr(map, "nope", "tampoco")).toBeNull();
  });

  it("returns null when no candidates provided", () => {
    expect(getAttr(map)).toBeNull();
  });
});
