import { describe, it, expect } from "vitest";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("devuelve el valor si llega a tiempo", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("propaga el error original si la promesa falla", async () => {
    await expect(withTimeout(Promise.reject(new Error("fallo real")), 100))
      .rejects.toThrow("fallo real");
  });

  it("rechaza una promesa que no resuelve nunca — el caso de /consulta", async () => {
    const colgada = new Promise<string>(() => {}); // ni resolve ni reject
    await expect(withTimeout(colgada, 20, "tardo demasiado"))
      .rejects.toThrow("tardo demasiado");
  });

  it("no deja el temporizador vivo cuando resuelve pronto", async () => {
    // Si no se limpiara, un timeout largo mantendria el proceso despierto.
    await expect(withTimeout(Promise.resolve(1), 60000)).resolves.toBe(1);
  });
});
