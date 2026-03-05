import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/clients/client-detail";
import { getClientById } from "@/server/queries/clients";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) {
    notFound();
  }

  return <ClientDetail client={client} />;
}
