import { describe, it, expect } from "vitest";
import {
  buildPickupRequest,
  checkPickupData,
  joinEs,
  pickupBlockers,
  type PickupRmaInput,
} from "./pickup-request";

/** RMA listo para pedir recogida al SAT del proveedor. */
function rma(overrides: Partial<PickupRmaInput> = {}): PickupRmaInput {
  return {
    id: "8f0c2b0e-1111-4222-8333-444455556666",
    rmaNumber: "RMA-2026-00123",
    clientName: "Bar La Esquina SL",
    clientCompanyName: null,
    deviceType: "TPV",
    deviceBrand: "10POS",
    deviceModel: "10D-21 J6412",
    deviceSerialNumber: "10D21-2405-01187",
    shipping: {
      locationName: "Bar La Esquina",
      contactName: "Laura",
      contactEmail: "laura@example.com",
      contactPhone: "600 00 00 00",
      address: "C/ Ejemplo 12",
      postalCode: "28004",
      city: "Madrid",
      province: "Madrid",
      reference: "RMA-2026-00123",
      instructions: "Preguntar por el encargado",
      destination: {
        type: "sat",
        name: "SAT 10POS",
        address: "Pol. Ind. Ejemplo, nave 3",
        postalCode: "08040",
        city: "Barcelona",
        province: "Barcelona",
        contact: "Recepción",
        phone: "930000000",
      },
    },
    ...overrides,
  };
}

describe("buildPickupRequest", () => {
  it("builds the contract body for a SAT destination", () => {
    const res = buildPickupRequest(rma(), { name: "Ana Técnica", email: "ana@qamarero.com" });
    expect(res).toEqual({
      ok: true,
      body: {
        rma_id: "8f0c2b0e-1111-4222-8333-444455556666",
        rma_number: "RMA-2026-00123",
        requested_by: { name: "Ana Técnica", email: "ana@qamarero.com" },
        origin: {
          name: "Bar La Esquina",
          contact_name: "Laura",
          phone: "600000000",
          email: "laura@example.com",
          address: "C/ Ejemplo 12",
          postal_code: "28004",
          city: "Madrid",
          province: "Madrid",
        },
        destination: {
          type: "sat",
          name: "SAT 10POS",
          contact_name: "Recepción",
          phone: "930000000",
          address: "Pol. Ind. Ejemplo, nave 3",
          postal_code: "08040",
          city: "Barcelona",
        },
        items: [{ description: "10POS 10D-21 J6412", serial: "10D21-2405-01187" }],
        instructions: "Preguntar por el encargado",
      },
    });
  });

  it("sends only the type for the office destination", () => {
    const base = rma();
    const res = buildPickupRequest(
      rma({ shipping: { ...base.shipping, destination: { type: "oficina", name: "ignorado" } } })
    );
    expect(res.ok && res.body.destination).toEqual({ type: "oficina" });
  });

  it("omits empty optional fields instead of sending blanks", () => {
    const base = rma();
    const res = buildPickupRequest(
      rma({
        deviceBrand: null,
        deviceModel: "",
        deviceType: null,
        deviceSerialNumber: "  ",
        shipping: {
          ...base.shipping,
          contactName: "",
          contactEmail: "   ",
          province: undefined,
          instructions: "",
          destination: { type: "oficina" },
        },
      }),
      null
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.body.origin).toEqual({
      name: "Bar La Esquina",
      phone: "600000000",
      address: "C/ Ejemplo 12",
      postal_code: "28004",
      city: "Madrid",
    });
    expect(res.body).not.toHaveProperty("items");
    expect(res.body).not.toHaveProperty("instructions");
    expect(res.body).not.toHaveProperty("requested_by");
  });

  it("falls back to the device type when there is no brand or model", () => {
    const res = buildPickupRequest(rma({ deviceBrand: null, deviceModel: null, deviceSerialNumber: null }));
    expect(res.ok && res.body.items).toEqual([{ description: "TPV" }]);
  });

  it("uses the client name when the pickup form has no location name", () => {
    const base = rma();
    const res = buildPickupRequest(
      rma({ clientCompanyName: "Bar La Esquina (CX)", shipping: { ...base.shipping, locationName: "" } })
    );
    expect(res.ok && res.body.origin.name).toBe("Bar La Esquina (CX)");
  });

  it("uses the email as requester name when the session has no name", () => {
    const res = buildPickupRequest(rma(), { name: null, email: "ana@qamarero.com" });
    expect(res.ok && res.body.requested_by).toEqual({ name: "ana@qamarero.com", email: "ana@qamarero.com" });
  });

  it("returns a Spanish error listing what is missing", () => {
    const res = buildPickupRequest(rma({ shipping: { address: "C/ Ejemplo 12", destination: { type: "oficina" } } }));
    expect(res).toEqual({
      ok: false,
      error:
        "Faltan datos de recogida: código postal, ciudad y teléfono. Complétalos en «Datos de recogida/envío».",
    });
  });

  it("refuses a pickup going straight to the client", () => {
    const base = rma();
    const res = buildPickupRequest(rma({ shipping: { ...base.shipping, destination: { type: "cliente" } } }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/oficina o al SAT/);
  });
});

describe("checkPickupData", () => {
  it("is ok when origin and SAT destination are complete", () => {
    expect(checkPickupData(rma())).toEqual({ ok: true });
  });

  it("reports a postal code that is not 5 digits", () => {
    const base = rma();
    const res = checkPickupData(rma({ shipping: { ...base.shipping, postalCode: "2804" } }));
    expect(res).toEqual({ ok: false, reason: "faltan_datos", missing: ["código postal de 5 dígitos"] });
  });

  it("accepts a postal code typed with a space", () => {
    const base = rma();
    expect(checkPickupData(rma({ shipping: { ...base.shipping, postalCode: "28 004" } }))).toEqual({ ok: true });
  });

  it("requires choosing a destination", () => {
    const base = rma();
    const res = checkPickupData(rma({ shipping: { ...base.shipping, destination: { type: "" } } }));
    expect(res).toEqual({ ok: false, reason: "faltan_datos", missing: ["destino (oficina o SAT)"] });
  });

  it("requires the SAT address when the destination is the SAT", () => {
    const base = rma();
    const res = checkPickupData(rma({ shipping: { ...base.shipping, destination: { type: "sat", name: "SAT" } } }));
    expect(res).toEqual({
      ok: false,
      reason: "faltan_datos",
      missing: ["dirección del SAT", "código postal del SAT", "ciudad del SAT"],
    });
  });

  it("reports everything when there is no shipping data at all", () => {
    const res = checkPickupData(rma({ shipping: null, clientName: null, clientCompanyName: null }));
    expect(res).toEqual({
      ok: false,
      reason: "faltan_datos",
      missing: ["nombre del local", "dirección", "código postal", "ciudad", "teléfono", "destino (oficina o SAT)"],
    });
  });

  it("flags the client destination before missing data", () => {
    expect(checkPickupData(rma({ shipping: { destination: { type: "cliente" } } }))).toEqual({
      ok: false,
      reason: "destino_cliente",
    });
  });
});

describe("joinEs", () => {
  it("joins lists the Spanish way", () => {
    expect(joinEs([])).toBe("");
    expect(joinEs(["a"])).toBe("a");
    expect(joinEs(["a", "b"])).toBe("a y b");
    expect(joinEs(["a", "b", "c"])).toBe("a, b y c");
  });
});

describe("pickupBlockers", () => {
  const ours = { logistics: "nosotros_intermediamos" };

  it("vacío con la logística nuestra y los datos completos", () => {
    expect(pickupBlockers(rma(ours))).toEqual([]);
  });

  it("sin logística marcada explica que hay que marcarla", () => {
    const out = pickupBlockers(rma());
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("marca la logística como «Nosotros recogemos y enviamos»");
  });

  it("con «Proveedor recoge y envía» lo dice tal cual", () => {
    const out = pickupBlockers(rma({ logistics: "proveedor_gestiona" }));
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("«Proveedor recoge y envía»");
  });

  it("junta todas las causas: logística y destino", () => {
    const base = rma();
    const out = pickupBlockers({ ...base, shipping: { ...base.shipping, destination: undefined } });
    expect(out).toHaveLength(2);
    expect(out[1]).toBe("Falta destino (oficina o SAT): complétalo en «Datos de recogida/envío».");
  });

  it("plural cuando falta más de un dato", () => {
    const base = rma(ours);
    const out = pickupBlockers({ ...base, shipping: { ...base.shipping, city: "", contactPhone: "" } });
    expect(out).toEqual(["Falta ciudad y teléfono: complétalos en «Datos de recogida/envío»."]);
  });

  it("destino al cliente: pide cambiar el destino", () => {
    const base = rma(ours);
    const out = pickupBlockers({ ...base, shipping: { ...base.shipping, destination: { type: "cliente" } } });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("cambia el destino");
  });
});

describe("buildPickupRequest · horario del cliente", () => {
  function withHours(from: string, to: string) {
    const base = rma();
    return buildPickupRequest({ ...base, shipping: { ...base.shipping, pickupFrom: from, pickupTo: to } });
  }

  it("manda la franja cuando está completa y tiene sentido", () => {
    const r = withHours("10:00", "13:00");
    expect(r.ok && r.body.time_from).toBe("10:00");
    expect(r.ok && r.body.time_to).toBe("13:00");
  });

  it("no la manda a medias ni al revés (MainOps la rechazaría)", () => {
    for (const [from, to] of [["10:00", ""], ["", "13:00"], ["13:00", "10:00"]]) {
      const r = withHours(from, to);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.body.time_from).toBeUndefined();
        expect(r.body.time_to).toBeUndefined();
      }
    }
  });
});
