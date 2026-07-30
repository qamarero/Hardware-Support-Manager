import { auth } from "./index";
import type { UserRole } from "@/lib/constants/roles";

export async function getRequiredSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Sesión expirada. Recarga la página e inicia sesión de nuevo.");
  }
  return session;
}

export async function requireRole(...roles: UserRole[]) {
  const session = await getRequiredSession();
  if (!roles.includes(session.user.role as UserRole)) {
    throw new Error("No tienes permisos para esta acción.");
  }
  return session;
}

/**
 * Exige permiso de ESCRITURA (admin o técnico). El rol "viewer" (compañeros de
 * soporte) queda confinado a solo lectura + comentarios: cualquier mutación que
 * llame a esto lo rechaza. Defensa server-side del confinamiento del Visor.
 */
export async function requireWriteAccess() {
  return requireRole("admin", "technician");
}
