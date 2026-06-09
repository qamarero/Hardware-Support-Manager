import type { Metadata } from "next";

export const metadata: Metadata = { title: "Corcho" };

export default function CorchoPage() {
  return (
    <div>
      <div className="topbar__title" style={{ marginBottom: 24 }}>
        <h1>Corcho</h1>
        <p>Vista rápida de incidencias para el día</p>
      </div>
      <div className="empty">
        <h4>Próximamente</h4>
        <p className="muted">El tablero de corcho se está reconstruyendo (W2).</p>
      </div>
    </div>
  );
}
