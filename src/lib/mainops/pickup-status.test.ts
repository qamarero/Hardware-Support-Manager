import { describe, it, expect } from "vitest";
import type { RmaPickup } from "@/lib/db/schema/rmas";
import {
  canCancelPickup,
  decidePickupUpdate,
  describePickup,
  formatPickupDate,
  formatPickupTime,
  formatPickupWindow,
  isActivePickup,
} from "./pickup-status";

function pickup(overrides: Partial<RmaPickup> = {}): RmaPickup {
  return {
    pickup_id: "RC-202610-0001",
    rma_id: "8f0c2b0e-1111-4222-8333-444455556666",
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
    ...overrides,
  };
}

const programada = pickup({
  status: "programada",
  status_label: "Programada",
  pickup_date: "2026-10-26",
  time_from: "09:00",
  time_to: "14:00",
  tipsa_code: "0028850418",
  updated_at: "2026-10-23T16:40:00.000Z",
});

describe("pickup formatting", () => {
  it("formats the Madrid local date with a Spanish weekday", () => {
    expect(formatPickupDate("2026-10-26")).toBe("lun 26/10");
    expect(formatPickupDate("2026-11-01")).toBe("dom 01/11");
    expect(formatPickupDate(null)).toBeNull();
    expect(formatPickupDate("mañana")).toBeNull();
  });

  it("drops the leading zero of the hour", () => {
    expect(formatPickupTime("09:00")).toBe("9:00");
    expect(formatPickupTime("14:30:00")).toBe("14:30");
    expect(formatPickupTime(null)).toBeNull();
  });

  it("builds the window with whatever times exist", () => {
    expect(formatPickupWindow(programada)).toBe("lun 26/10, 9:00–14:00");
    expect(formatPickupWindow({ ...programada, time_to: null })).toBe("lun 26/10, desde las 9:00");
    expect(formatPickupWindow({ ...programada, time_from: null, time_to: null })).toBe("lun 26/10");
    expect(formatPickupWindow({ ...programada, pickup_date: null })).toBeNull();
  });
});

describe("describePickup", () => {
  it("describes each status for the RMA history", () => {
    expect(describePickup(pickup())).toBe("Recogida solicitada a MainOps · RC-202610-0001");
    expect(describePickup(programada)).toBe(
      "Recogida programada para lun 26/10, 9:00–14:00 · TIPSA 0028850418"
    );
    expect(
      describePickup(pickup({ status: "incidencia", incidence: { code: "AS", label: "Ausente", observations: null } }))
    ).toBe("Incidencia en la recogida: Ausente");
    expect(describePickup(pickup({ status: "en_curso", albaran: "0000012890" }))).toBe(
      "Recogida realizada · albarán 0000012890"
    );
    expect(describePickup(pickup({ status: "recibida" }))).toBe("Recogida recibida en destino");
    expect(describePickup(pickup({ status: "anulada", cancel_reason: "El cliente lo trae a la oficina" }))).toBe(
      "Recogida anulada: El cliente lo trae a la oficina"
    );
  });

  it("degrades gracefully when optional data is missing", () => {
    expect(describePickup(pickup({ status: "programada" }))).toBe("Recogida programada");
    expect(describePickup(pickup({ status: "incidencia" }))).toBe("Incidencia en la recogida");
    expect(describePickup(pickup({ status: "en_curso" }))).toBe("Recogida realizada");
    expect(describePickup(pickup({ status: "anulada" }))).toBe("Recogida anulada");
  });

  it("adds TIPSA observations to the incidence", () => {
    const p = pickup({
      status: "incidencia",
      incidence: { code: "AS", label: "Ausente", observations: "No contesta al timbre" },
    });
    expect(describePickup(p)).toBe("Incidencia en la recogida: Ausente (No contesta al timbre)");
  });
});

describe("isActivePickup / canCancelPickup", () => {
  it("treats every status except anulada as active", () => {
    expect(isActivePickup(null)).toBe(false);
    expect(isActivePickup(pickup({ status: "anulada" }))).toBe(false);
    for (const status of ["solicitada", "programada", "incidencia", "en_curso", "recibida"] as const) {
      expect(isActivePickup(pickup({ status }))).toBe(true);
    }
  });

  it("only lets HSM cancel while solicitada", () => {
    expect(canCancelPickup(pickup())).toBe(true);
    expect(canCancelPickup(programada)).toBe(false);
    expect(canCancelPickup(null)).toBe(false);
  });
});

describe("decidePickupUpdate", () => {
  it("applies the first update and writes its history entry", () => {
    expect(decidePickupUpdate(null, programada)).toEqual({
      apply: true,
      eventText: "Recogida programada para lun 26/10, 9:00–14:00 · TIPSA 0028850418",
      fillTracking: null,
    });
  });

  it("ignores a repeated webhook with the same status and updated_at", () => {
    expect(decidePickupUpdate(programada, { ...programada })).toEqual({ apply: false, reason: "duplicado" });
    // También cuando la respuesta viene de una llamada nuestra (sincronizar).
    expect(decidePickupUpdate(programada, { ...programada }, { authoritative: true })).toEqual({
      apply: false,
      reason: "duplicado",
    });
  });

  it("applies a status change of the same pickup", () => {
    const incidencia = pickup({
      status: "incidencia",
      incidence: { code: "AS", label: "Ausente", observations: null },
      updated_at: "2026-10-26T12:00:00.000Z",
    });
    expect(decidePickupUpdate(programada, incidencia)).toEqual({
      apply: true,
      eventText: "Incidencia en la recogida: Ausente",
      fillTracking: null,
    });
  });

  it("stores a same-status refresh without a duplicate history entry", () => {
    const refreshed = { ...programada, updated_at: "2026-10-24T08:00:00.000Z" };
    expect(decidePickupUpdate(programada, refreshed)).toEqual({ apply: true, eventText: null, fillTracking: null });
  });

  it("logs a rescheduled date even if the status is the same", () => {
    const moved = { ...programada, pickup_date: "2026-10-27", updated_at: "2026-10-24T08:00:00.000Z" };
    const res = decidePickupUpdate(programada, moved);
    expect(res).toEqual({
      apply: true,
      eventText: "Recogida programada para mar 27/10, 9:00–14:00 · TIPSA 0028850418",
      fillTracking: null,
    });
  });

  it("ignores an out-of-order webhook older than what is stored", () => {
    const late = pickup({ updated_at: "2026-10-23T15:02:11.000Z" }); // solicitada, antes de programada
    expect(decidePickupUpdate(programada, late)).toEqual({ apply: false, reason: "antiguo" });
  });

  it("never goes back to an older snapshot of the same pickup, even from our own calls", () => {
    // La respuesta a «Pedir» (solicitada) llega después del webhook «programada».
    const late = pickup({ updated_at: "2026-10-23T15:02:11.000Z" });
    expect(decidePickupUpdate(programada, late, { authoritative: true })).toEqual({
      apply: false,
      reason: "antiguo",
    });
  });

  it("ignores a webhook about a previous pickup once a newer one is stored", () => {
    const nueva = pickup({
      pickup_id: "RC-202610-0002",
      created_at: "2026-10-25T09:00:00.000Z",
      updated_at: "2026-10-25T09:00:00.000Z",
    });
    const viejaAnulada = pickup({ status: "anulada", updated_at: "2026-10-25T10:00:00.000Z" });
    expect(decidePickupUpdate(nueva, viejaAnulada)).toEqual({ apply: false, reason: "otra_recogida" });
  });

  it("lets our own calls switch to the pickup MainOps says is current", () => {
    const nueva = pickup({
      pickup_id: "RC-202610-0002",
      created_at: "2026-10-25T09:00:00.000Z",
      updated_at: "2026-10-25T09:00:00.000Z",
    });
    const vigente = { ...programada, updated_at: "2026-10-25T11:00:00.000Z" };
    const res = decidePickupUpdate(nueva, vigente, { authoritative: true });
    expect(res).toEqual({
      apply: true,
      eventText: "Recogida programada para lun 26/10, 9:00–14:00 · TIPSA 0028850418",
      fillTracking: null,
    });
  });

  it("accepts a newer pickup replacing a cancelled one", () => {
    const anulada = pickup({ status: "anulada", updated_at: "2026-10-24T09:00:00.000Z" });
    const nueva = pickup({
      pickup_id: "RC-202610-0002",
      created_at: "2026-10-25T09:00:00.000Z",
      updated_at: "2026-10-25T09:00:00.000Z",
    });
    expect(decidePickupUpdate(anulada, nueva)).toEqual({
      apply: true,
      eventText: "Recogida solicitada a MainOps · RC-202610-0002",
      fillTracking: null,
    });
  });

  it("copies the albarán to the outgoing tracking only when it is empty", () => {
    const enCurso = pickup({ status: "en_curso", albaran: "0000012890", updated_at: "2026-10-26T13:00:00.000Z" });
    expect(decidePickupUpdate(programada, enCurso, { trackingOutgoing: "  " })).toEqual({
      apply: true,
      eventText: "Recogida realizada · albarán 0000012890 · copiado a «Seguimiento (envío)»",
      fillTracking: "0000012890",
    });
    expect(decidePickupUpdate(programada, enCurso, { trackingOutgoing: "TRK-A-MANO" })).toEqual({
      apply: true,
      eventText: "Recogida realizada · albarán 0000012890",
      fillTracking: null,
    });
  });

  it("does not ignore anything when dates cannot be parsed", () => {
    const weird = pickup({ status: "programada", updated_at: "ayer" });
    expect(decidePickupUpdate(programada, weird).apply).toBe(true);
  });
});
