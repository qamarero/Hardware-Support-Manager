// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { authConfig } from "./config";

// La fila que devuelve la consulta de usuarios. Cada test la ajusta.
const state = vi.hoisted(() => ({ row: null as Record<string, unknown> | null }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (state.row ? [state.row] : []),
        }),
      }),
    }),
  },
}));

const PASSWORD = "contrasena-de-prueba-9271";
// Hash real, no mockeado: lo que se quiere comprobar es precisamente que la
// verificación de bcrypt funciona. Con bcrypt mockeado el test pasaría aunque
// el login aceptase cualquier contraseña, que es justo el fallo que había.
const HASH = bcrypt.hashSync(PASSWORD, 10);

const BASE_ROW = {
  id: "user-1",
  name: "Domingo Bueno",
  email: "domingo.bueno@qamarero.com",
  role: "admin",
  passwordHash: HASH,
  active: true,
};

// Credentials() de Auth.js devuelve un objeto con `authorize: () => null` y
// guarda la configuración real en `options`; el merge lo hace el core al
// arrancar. Hay que llamar a la de `options` o se estaría probando el stub,
// que devuelve null siempre — y entonces todos los casos de "rechaza" pasarían
// sin demostrar nada.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authorize = (authConfig.providers[0] as any).options.authorize as (
  c: Record<string, unknown>,
) => Promise<unknown>;

describe("authorize (login con contraseña)", () => {
  beforeEach(() => {
    state.row = { ...BASE_ROW };
  });

  it("deja entrar con la contraseña correcta", async () => {
    const user = await authorize({ email: BASE_ROW.email, password: PASSWORD });
    expect(user).toMatchObject({
      id: "user-1",
      email: "domingo.bueno@qamarero.com",
      role: "admin",
    });
  });

  it("no devuelve el hash en la sesión", async () => {
    const user = await authorize({ email: BASE_ROW.email, password: PASSWORD });
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("rechaza una contraseña incorrecta", async () => {
    expect(await authorize({ email: BASE_ROW.email, password: "otra" })).toBeNull();
  });

  it("rechaza una contraseña vacía", async () => {
    expect(await authorize({ email: BASE_ROW.email, password: "" })).toBeNull();
  });

  it("rechaza si no se manda contraseña — el fallo que tenía el login", async () => {
    expect(await authorize({ email: BASE_ROW.email })).toBeNull();
  });

  it("rechaza a un usuario que no existe", async () => {
    state.row = null;
    expect(await authorize({ email: "nadie@qamarero.com", password: PASSWORD })).toBeNull();
  });

  it("rechaza a un usuario desactivado aunque acierte la contraseña", async () => {
    state.row = { ...BASE_ROW, active: false };
    expect(await authorize({ email: BASE_ROW.email, password: PASSWORD })).toBeNull();
  });

  it("acepta el correo tecleado con otras mayúsculas", async () => {
    const user = await authorize({ email: "Domingo.Bueno@Qamarero.com", password: PASSWORD });
    expect(user).toMatchObject({ id: "user-1" });
  });
});

describe("authorized (rutas públicas y confinamiento del Visor)", () => {
  const call = (path: string, role?: string) =>
    authConfig.callbacks!.authorized!({
      auth: role ? ({ user: { role } } as never) : null,
      request: { nextUrl: new URL(`https://hsm.test${path}`) } as never,
    } as never);

  it("un Visor puede abrir /submit", async () => {
    expect(await call("/submit", "viewer")).toBe(true);
  });

  it("un anónimo puede abrir /submit", async () => {
    expect(await call("/submit")).toBe(true);
  });

  it("/submissions NO es público — startsWith('/submit') es true y sería un agujero", async () => {
    expect(await call("/submissions")).toBe(false);
  });

  it("un Visor sigue confinado: /incidents lo devuelve a /consulta", async () => {
    const res = await call("/incidents", "viewer");
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).headers.get("location")).toContain("/consulta");
  });

  it("un Visor entra en /consulta", async () => {
    expect(await call("/consulta", "viewer")).toBe(true);
  });

  it("un anónimo no entra en /dashboard", async () => {
    expect(await call("/dashboard")).toBe(false);
  });

  // El confinamiento del Visor llegó a encerrarlo: /login caía en la regla
  // general y lo devolvía a /consulta, así que con la cuenta de soporte
  // abierta no había forma de volver a la de administrador.
  it("/logout funciona para todos, incluido el Visor confinado", async () => {
    expect(await call("/logout", "viewer")).toBe(true);
    expect(await call("/logout", "admin")).toBe(true);
    expect(await call("/logout")).toBe(true);
    expect(await call("/limpiar", "viewer")).toBe(true);
    expect(await call("/limpiar")).toBe(true);
  });

  it("un Visor PUEDE abrir /login — es su única salida", async () => {
    expect(await call("/login", "viewer")).toBe(true);
  });

  it("un anónimo puede abrir /login", async () => {
    expect(await call("/login")).toBe(true);
  });

  it("a un admin con sesión se le ahorra el formulario de login", async () => {
    const res = await call("/login", "admin");
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).headers.get("location")).toContain("/dashboard");
  });
});
