import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Proveedores",
};
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProviders } from "@/server/queries/providers";
import { ProviderList } from "@/components/providers/provider-list";

interface ProvidersPageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const params = await searchParams;

  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;
  const search = params.search || "";
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = (params.sortOrder as "asc" | "desc") || "desc";

  const initialData = await getProviders({
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Proveedores</h1>
            <p className="text-sm text-muted-foreground">Gestión de proveedores</p>
          </div>
        </div>
        <Button asChild>
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
