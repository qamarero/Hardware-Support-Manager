import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/get-session";
import { CreateUserPage } from "@/components/users/create-user-page";

export default async function NewUserPage() {
  try {
    await requireRole("admin");
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Nuevo Usuario</h1>
      <CreateUserPage />
    </div>
  );
}
