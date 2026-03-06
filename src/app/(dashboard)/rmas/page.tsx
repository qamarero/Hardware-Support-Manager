import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "RMAs",
};
import { RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRmas } from "@/server/queries/rmas";
import { RmaPageContent } from "@/components/rmas/rma-page-content";
import type { SortOrder } from "@/types";

export default async function RmasPage({
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

  const initialData = await getRmas({
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">RMAs</h1>
            <p className="text-sm text-muted-foreground">
              Autorizaciones de devolución de mercancía
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/rmas/new">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo RMA
          </Link>
        </Button>
      </div>
      <RmaPageContent initialData={initialData} />
    </div>
  );
}
