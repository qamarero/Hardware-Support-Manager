// @vitest-environment node
// Código de servidor: fetch, Response y AbortSignal.timeout de Node, no los de jsdom.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MainOpsError,
  cancelPickup,
  describeMainOpsField,
  getPickups,
  mainOpsErrorMessage,
  requestPickup,
} from "./client";
import type { PickupRmaInput } from "./pickup-request";

const RMA_ID = "8f0c2b0e-1111-4222-8333-444455556666";

const dto = {
  pickup_id: "RC-202610-0001",
  rma_id: RMA_ID,
  rma_number: "RMA-2026-00123",
  status: "solicitada",
  status_label: "Solicitada",
  pickup_date: null,
  time_from: null,
  time_to: null,
  tipsa_code: null,
  albaran: null,
  incidence: null,
  last_event: null,
  cancel_reason: null,
  created_at: "2026-10-23T15:02:11.000Z",
  updated_at: "2026-10-23T15:02:11.000Z",
};

const rma: PickupRmaInput = {
  id: RMA_ID,
  rmaNumber: "RMA-2026-00123",
  clientName: "Bar La Esquina",
  deviceBrand: "10POS",
  deviceModel: "10D-21",
  shipping: {
    contactPhone: "600000000",
    address: "C/ Ejemplo 12",
    postalCode: "28004",
    city: "Madrid",
    destination: { type: "oficina" },
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("mainOpsErrorMessage", () => {
  it("names the rejected field on a 400", () => {
    expect(mainOpsErrorMessage("solicitar", 400, { error: "CP inválido", field: "origin.postal_code" })).toBe(
      "MainOps rechaza el dato «código postal de recogida»: CP inválido"
    );
    expect(mainOpsErrorMessage("solicitar", 400, { error: "Destino no válido" })).toBe(
      "MainOps rechaza la petición: Destino no válido"
    );
  });

  it("explains a 409 on cancel as already scheduled", () => {
    expect(mainOpsErrorMessage("anular", 409, { error: "conflict" })).toBe(
      "Ya está programada: pide a logística que la anule desde MainOps"
    );
  });

  it("reports MainOps without HSM_API_KEY as not configured", () => {
    expect(mainOpsErrorMessage("consultar", 503, null)).toBe("MainOps no está configurado");
  });

  it("points at the API key on 401/403", () => {
    expect(mainOpsErrorMessage("solicitar", 401, null)).toMatch(/MAINOPS_API_KEY/);
    expect(mainOpsErrorMessage("solicitar", 403, null)).toMatch(/MAINOPS_API_KEY/);
  });

  it("has a generic message for other errors", () => {
    expect(mainOpsErrorMessage("solicitar", 500, "boom")).toBe(
      "MainOps ha fallado (error 500). Prueba de nuevo en un rato"
    );
  });
});

describe("describeMainOpsField", () => {
  it("maps known paths and nested array paths", () => {
    expect(describeMainOpsField("destination.city")).toBe("ciudad del destino");
    expect(describeMainOpsField("items.0.serial")).toBe("equipo a recoger");
    expect(describeMainOpsField("items[0].description")).toBe("equipo a recoger");
    expect(describeMainOpsField("algo.raro")).toBe("algo.raro");
  });
});

describe("MainOps HTTP calls", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("MAINOPS_BASE_URL", "https://mainops.example.com/");
    vi.stubEnv("MAINOPS_API_KEY", "secreto-hsm");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses to call when MainOps is not configured", async () => {
    vi.stubEnv("MAINOPS_API_KEY", "");
    await expect(requestPickup(rma)).rejects.toThrow("MainOps no está configurado");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call MainOps when pickup data is missing", async () => {
    await expect(requestPickup({ ...rma, shipping: {} })).rejects.toThrow(/Faltan datos de recogida/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the pickup with the API key and reports a new one on 201", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { pickup: dto }));
    const res = await requestPickup(rma, { name: "Ana", email: "ana@qamarero.com" });

    expect(res.created).toBe(true);
    expect(res.pickup.pickup_id).toBe("RC-202610-0001");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mainops.example.com/api/external/hsm/pickups");
    expect(init.method).toBe("POST");
    expect(init.headers["X-API-Key"]).toBe("secreto-hsm");
    expect(JSON.parse(init.body)).toMatchObject({
      rma_id: RMA_ID,
      rma_number: "RMA-2026-00123",
      destination: { type: "oficina" },
      requested_by: { name: "Ana", email: "ana@qamarero.com" },
    });
  });

  it("reports an existing active pickup on 200", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { pickup: { ...dto, status: "programada" } }));
    const res = await requestPickup(rma);
    expect(res.created).toBe(false);
    expect(res.pickup.status).toBe("programada");
  });

  it("turns a 409 on cancel into the logistics message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: "Ya programada" }));
    const err = await cancelPickup("RC-202610-0001", "motivo").catch((e) => e);
    expect(err).toBeInstanceOf(MainOpsError);
    expect(err.status).toBe(409);
    expect(err.message).toBe("Ya está programada: pide a logística que la anule desde MainOps");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mainops.example.com/api/external/hsm/pickups/RC-202610-0001/cancel");
    expect(JSON.parse(init.body)).toEqual({ reason: "motivo" });
  });

  it("lists pickups by rma_id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { pickups: [{ ...dto, status: "anulada" }, dto] }));
    const list = await getPickups(RMA_ID);
    expect(list.map((p) => p.status)).toEqual(["anulada", "solicitada"]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://mainops.example.com/api/external/hsm/pickups?rma_id=${RMA_ID}`
    );
  });

  it("explains a network failure in Spanish", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(getPickups(RMA_ID)).rejects.toThrow("No se pudo contactar con MainOps");
  });

  it("rejects a response that does not match the contract", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { pickup: { ...dto, status: "perdida" } }));
    await expect(requestPickup(rma)).rejects.toThrow("MainOps ha respondido algo que HSM no entiende");
  });
});
