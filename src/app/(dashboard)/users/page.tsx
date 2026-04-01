import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserList } from "@/components/users/user-list";
import { getUsers } from "@/server/queries/users";
import { requireRole } from "@/lib/auth/get-session";
import type { SortOrder } from "@/types";

export const metadata: Metadata = {
  title: "Usuarios",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireRole("admin");
  } catch {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;
  const sortBy = typeof params.sortBy === "string" ? params.sortBy : "createdAt";
  const sortOrder = (typeof params.sortOrder === "string" ? params.sortOrder : "desc") as SortOrder;

  const initialData = await getUsers({
    page,
    pageSize,
    sortBy,
    sortOrder,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Usuarios</h1>
            <p className="text-sm text-muted-foreground">Administración de usuarios del sistema</p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/users/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Usuario
          </Link>
        </Button>
      </div>
      <UserList initialData={initialData} />
    </div>
  );
}
