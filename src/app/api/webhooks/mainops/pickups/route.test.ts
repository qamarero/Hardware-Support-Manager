// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const applyPickupUpdate = vi.fn();
vi.mock("@/lib/mainops/store", () => ({
  applyPickupUpdate: (...args: unknown[]) => applyPickupUpdate(...args),
}));

import { POST } from "./route";

const RMA_ID = "8f0c2b0e-1111-4222-8333-444455556666";

const pickup = {
  pickup_id: "RC-202610-0001",
  rma_id: RMA_ID,
  rma_number: "RMA-2026-00123",
  status: "en_curso",
  status_label: "Recogida · en camino",
  pickup_date: "2026-10-26",
  time_from: "09:00",
  time_to: "14:00",
  tipsa_code: "0028850418",
  albaran: "0000012890",
  incidence: null,
  last_event: null,
  cancel_reason: null,
  created_at: "2026-10-23T15:02:11.000Z",
  updated_at: "2026-10-26T13:00:00.000Z",
};

function post(body: unknown, key: string | null = "clave-webhook"): Request {
  return new Request("https://hsm.example.com/api/webhooks/mainops/pickups", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "X-API-Key": key } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/webhooks/mainops/pickups", () => {
  beforeEach(() => {
    vi.stubEnv("MAINOPS_WEBHOOK_KEY", "clave-webhook");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    applyPickupUpdate.mockReset();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("answers 503 when MAINOPS_WEBHOOK_KEY is not set", async () => {
    vi.stubEnv("MAINOPS_WEBHOOK_KEY", "");
    const res = await POST(post({ event: "pickup.status_changed", pickup }));
    expect(res.status).toBe(503);
    expect(applyPickupUpdate).not.toHaveBeenCalled();
  });

  it("answers 401 without key and 403 with a wrong key", async () => {
    expect((await POST(post({}, null))).status).toBe(401);
    expect((await POST(post({}, "otra-clave"))).status).toBe(403);
    expect(applyPickupUpdate).not.toHaveBeenCalled();
  });

  it("answers 400 to malformed JSON or payload", async () => {
    expect((await POST(post("{no es json"))).status).toBe(400);
    const res = await POST(post({ event: "pickup.status_changed", pickup: { ...pickup, status: "perdida" } }));
    expect(res.status).toBe(400);
    expect(applyPickupUpdate).not.toHaveBeenCalled();
  });

  it("acknowledges unknown events without touching the RMA", async () => {
    const res = await POST(post({ event: "pickup.algo_nuevo", pickup }));
    expect(res.status).toBe(200);
    expect(applyPickupUpdate).not.toHaveBeenCalled();
  });

  it("answers 404 when the RMA does not exist", async () => {
    applyPickupUpdate.mockResolvedValueOnce({ found: false });
    const res = await POST(post({ event: "pickup.status_changed", pickup }));
    expect(res.status).toBe(404);
  });

  it("answers 404 for an rma_id that cannot be an HSM id", async () => {
    const res = await POST(post({ event: "pickup.status_changed", pickup: { ...pickup, rma_id: "RMA-2026-00123" } }));
    expect(res.status).toBe(404);
    expect(applyPickupUpdate).not.toHaveBeenCalled();
  });

  it("stores the pickup as a webhook update and reports the filled tracking", async () => {
    applyPickupUpdate.mockResolvedValueOnce({ found: true, applied: true, pickup, trackingFilled: "0000012890" });
    const res = await POST(post({ event: "pickup.status_changed", pickup }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: true, tracking_filled: "0000012890" });
    expect(applyPickupUpdate).toHaveBeenCalledWith(RMA_ID, expect.objectContaining({ pickup_id: "RC-202610-0001" }), {
      userId: null,
      source: "webhook",
    });
  });

  it("answers 200 to a duplicate so MainOps stops retrying", async () => {
    applyPickupUpdate.mockResolvedValueOnce({ found: true, applied: false, reason: "duplicado", pickup });
    const res = await POST(post({ event: "pickup.status_changed", pickup }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: false, reason: "duplicado" });
  });

  it("answers 500 when saving fails so MainOps retries", async () => {
    applyPickupUpdate.mockRejectedValueOnce(new Error("db caída"));
    const res = await POST(post({ event: "pickup.status_changed", pickup }));
    expect(res.status).toBe(500);
  });
});
