import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RmaDetail } from "@/components/rmas/rma-detail";
import { getRmaById } from "@/server/queries/rmas";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const rma = await getRmaById(id);

  if (!rma) {
    return { title: "RMA no encontrado" };
  }

  return {
    title: rma.rmaNumber,
  };
}

export default async function RmaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const rma = await getRmaById(id);

  if (!rma) {
    notFound();
  }

  return <RmaDetail rma={rma} />;
}
