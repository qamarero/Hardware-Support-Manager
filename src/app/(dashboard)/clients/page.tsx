import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientList } from "@/components/clients/client-list";
import { getClients } from "@/server/queries/clients";
import type { SortOrder } from "@/types";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;
  const search = typeof params.search === "string" ? params.search : undefined;
  const sortBy = typeof params.sortBy === "string" ? params.sortBy : "createdAt";
  const sortOrder = (typeof params.sortOrder === "string" ? params.sortOrder : "desc") as SortOrder;

  const initialData = await getClients({
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">Gestión de clientes</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Cliente
          </Link>
        </Button>
      </div>
      <ClientList initialData={initialData} />
    </div>
  );
}
