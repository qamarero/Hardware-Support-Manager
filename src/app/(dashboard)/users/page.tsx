import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/get-session";
import { UsersScreen } from "@/components/users-v2/users-screen";

export const metadata: Metadata = { title: "Usuarios" };

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  try {
    await requireRole("admin");
  } catch {
    redirect("/dashboard");
  }
  return <UsersScreen />;
}
