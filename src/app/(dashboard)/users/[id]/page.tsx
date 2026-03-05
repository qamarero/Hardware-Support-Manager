import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/get-session";
import { getUserById } from "@/server/queries/users";
import { UserDetail } from "@/components/users/user-detail";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireRole("admin");
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const user = await getUserById(id);

  if (!user) {
    notFound();
  }

  return <UserDetail user={user} />;
}
