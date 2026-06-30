import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssetById } from "@/server/queries/assets";

export const dynamic = "force-dynamic";

export default async function EquipoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await getAssetById(id);
  if (!asset) notFound();

  const device = [asset.deviceBrand, asset.deviceModel].filter(Boolean).join(" ") || "Equipo sin especificar";

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="topbar__title">
        <h1>{asset.assetCode}</h1>
        <p>Equipo físico</p>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <dl className="dl">
          <dt>Código</dt><dd className="mono">{asset.assetCode}</dd>
          <dt>Equipo</dt><dd>{device}{asset.deviceType ? ` · ${asset.deviceType}` : ""}</dd>
          <dt>Nº de serie</dt><dd className="mono">{asset.deviceSerialNumber ?? "—"}</dd>
          <dt>Cliente</dt><dd>{asset.clientName ?? "—"}</dd>
          <dt>Estado</dt><dd>{asset.status}</dd>
          <dt>Ubicación</dt><dd>{asset.location ?? "—"}</dd>
          {asset.notes ? (<><dt>Notas</dt><dd style={{ whiteSpace: "pre-line" }}>{asset.notes}</dd></>) : null}
        </dl>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <a href={`/etiqueta/equipo/${asset.id}`} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm">
            Imprimir etiqueta
          </a>
          {asset.rmaId ? <Link href={`/rmas/${asset.rmaId}`} className="btn btn--outline btn--sm">Ver RMA vinculado</Link> : null}
          {asset.incidentId ? <Link href={`/incidents/${asset.incidentId}`} className="btn btn--outline btn--sm">Ver incidencia</Link> : null}
          <Link href="/equipos" className="btn btn--ghost btn--sm">Volver a Equipos</Link>
        </div>
      </div>
    </div>
  );
}
