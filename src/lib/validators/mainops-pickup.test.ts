import { describe, it, expect } from "vitest";
import { pickupDtoSchema, pickupWebhookSchema } from "./mainops-pickup";

const contractExample = {
  pickup_id: "RC-202610-0001",
  rma_id: "8f0c2b0e-1111-4222-8333-444455556666",
  rma_number: "RMA-2026-00123",
  status: "programada",
  status_label: "Programada",
  pickup_date: "2026-10-26",
  time_from: "09:00",
  time_to: "14:00",
  tipsa_code: "0028850418",
  albaran: null,
  incidence: null,
  last_event: { code: "12", label: "Leída repartidor", date: "2026-10-26T06:12:00.000Z" },
  cancel_reason: null,
  created_at: "2026-10-23T15:02:11.000Z",
  updated_at: "2026-10-23T16:40:00.000Z",
};

describe("pickupDtoSchema", () => {
  it("accepts the contract example unchanged", () => {
    const res = pickupDtoSchema.safeParse(contractExample);
    expect(res.success).toBe(true);
    expect(res.data).toEqual(contractExample);
  });

  it("normalizes missing, empty and numeric optional fields", () => {
    const res = pickupDtoSchema.safeParse({
      pickup_id: "RC-1",
      rma_id: "8f0c2b0e-1111-4222-8333-444455556666",
      status: "incidencia",
      tipsa_code: 28850418,
      albaran: "",
      incidence: { code: "AS", label: "Ausente" },
      last_event: { code: 4, label: "Incidencia" },
      updated_at: "2026-10-26T12:00:00.000Z",
      campo_nuevo: "se descarta",
    });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({
      pickup_id: "RC-1",
      rma_id: "8f0c2b0e-1111-4222-8333-444455556666",
      rma_number: null,
      status: "incidencia",
      status_label: null,
      pickup_date: null,
      time_from: null,
      time_to: null,
      tipsa_code: "28850418",
      albaran: null,
      incidence: { code: "AS", label: "Ausente", observations: null },
      last_event: { code: "4", label: "Incidencia", date: null },
      cancel_reason: null,
      created_at: null,
      updated_at: "2026-10-26T12:00:00.000Z",
    });
  });

  it("rejects an unknown status", () => {
    expect(pickupDtoSchema.safeParse({ ...contractExample, status: "perdida" }).success).toBe(false);
  });

  it("rejects a pickup without the fields HSM decides on", () => {
    expect(pickupDtoSchema.safeParse({ ...contractExample, updated_at: "" }).success).toBe(false);
    expect(pickupDtoSchema.safeParse({ ...contractExample, pickup_id: undefined }).success).toBe(false);
    expect(pickupDtoSchema.safeParse({ ...contractExample, rma_id: null }).success).toBe(false);
  });
});

describe("pickupWebhookSchema", () => {
  it("parses the webhook envelope", () => {
    const res = pickupWebhookSchema.safeParse({ event: "pickup.status_changed", pickup: contractExample });
    expect(res.success).toBe(true);
    expect(res.data?.pickup.status).toBe("programada");
  });

  it("requires the pickup", () => {
    expect(pickupWebhookSchema.safeParse({ event: "pickup.status_changed" }).success).toBe(false);
  });
});
