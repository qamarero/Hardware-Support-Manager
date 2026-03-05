import { notFound } from "next/navigation";
import { getProviderById } from "@/server/queries/providers";
import { ProviderDetail } from "@/components/providers/provider-detail";

interface ProviderPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProviderPage({ params }: ProviderPageProps) {
  const { id } = await params;
  const provider = await getProviderById(id);

  if (!provider) {
    notFound();
  }

  return <ProviderDetail provider={provider} />;
}
