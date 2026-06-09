import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inventario" };

export default function InventarioPage() {
  return (
    <div>
      <div className="topbar__title" style={{ marginBottom: 24 }}>
        <h1>Inventario</h1>
        <p>Equipos y dispositivos</p>
      </div>
      <div className="empty">
        <h4>Próximamente</h4>
        <p className="muted">La pantalla de inventario se construye en W4.</p>
      </div>
    </div>
  );
}
