import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClients } from "@/server/queries/clients";
import { ClientList } from "@/components/clients/client-list";

export const metadata: Metadata = {
  title: "Clientes",
};

interface ClientsPageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;

  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;
  const sortBy = params.sortBy || "name";
  const sortOrder = (params.sortOrder as "asc" | "desc") || "asc";

  const initialData = await getClients({
    page,
    pageSize,
    sortBy,
    sortOrder,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">Gestión de clientes y locales</p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto">
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
