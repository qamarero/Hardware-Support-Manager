import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProviders } from "@/server/queries/providers";
import { ProviderList } from "@/components/providers/provider-list";

export const metadata: Metadata = {
  title: "Proveedores",
};

interface ProvidersPageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const params = await searchParams;

  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = (params.sortOrder as "asc" | "desc") || "desc";

  const initialData = await getProviders({
    page,
    pageSize,
    sortBy,
    sortOrder,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Proveedores</h1>
            <p className="text-sm text-muted-foreground">Gestión de proveedores</p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/providers/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Proveedor
          </Link>
        </Button>
      </div>

      <ProviderList initialData={initialData} />
    </div>
  );
}
