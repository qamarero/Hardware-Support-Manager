"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Printer } from "lucide-react";

/**
 * Logo de marca para el documento impreso. Lienzo holgado (0 0 48 48) para que
 * el círculo naranja (cx=33 r=15 → llega a x=48) NO se recorte como ocurre con
 * el componente compartido (viewBox 0 0 42 48). Mark en #212121 sobre fondo blanco.
 */
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="Qamarero"
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      <circle cx="33" cy="15" r="15" fill="#F4532B" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M36.4541 10.4241C37.688 10.4241 38.6528 11.4903 38.5293 12.718L35.167 46.1243C35.0596 47.1893 34.1632 48.0003 33.0927 48.0003H5.65719C4.59162 48.0003 3.69731 47.1965 3.58395 46.137L0.0126591 12.7307C-0.11906 11.4988 0.846 10.4243 2.08492 10.4241H36.4541ZM7.67965 35.4153L8.46774 42.7884H30.2646L31.0068 35.4153H7.67965ZM7.12203 30.2034H31.5312L32.997 15.636H5.56442L7.12203 30.2034Z"
        fill="#212121"
      />
    </svg>
  );
}

export interface LabelData {
  kind: "RMA" | "Equipo";
  code: string;
  device: string;
  serial: string | null;
  client: string | null;
  provider?: string | null;
  statusLabel?: string | null;
  date: string;
  /** Ruta del registro en la plataforma (objetivo del QR). */
  recordPath: string;
}

export type LabelFormat = "etiqueta" | "envio";

/** Condiciones de recepción para la hoja A4 de envío. */
const NORMAS = [
  "No envíes ningún equipo sin un nº de RMA autorizado por Qamarero. Los envíos sin RMA no se aceptarán y se devolverán a su origen.",
  "El nº de RMA (RMA-AAAA-NNNNN) debe figurar visible en el exterior del bulto.",
  "Recorta y pega en el equipo la etiqueta de esta hoja (zona superior).",
  "Envía el equipo en su embalaje original o uno equivalente que lo proteja de golpes durante el transporte.",
  "Incluye todos los accesorios relacionados con la avería (cargador, cables, soportes, etc.).",
  "Conserva e indícanos el nº de seguimiento del envío para poder localizarlo.",
];

/** Datos de recepción de Qamarero. */
const RECEPCION = {
  empresa: "Qamarero — Hardware Support",
  direccion: "P.º Alcalde Marqués del Contadero, s/n, Casco Antiguo",
  cpCiudad: "41001 Sevilla",
  horario: "9:00 – 18:00",
  telefono: "602 687 553",
  contacto: "hardware@qamarero.com",
};

/** Aviso destacado (negrita) sobre el incumplimiento de las condiciones. */
const AVISO_INCUMPLIMIENTO =
  "Todo envío que no cumpla estas condiciones será rechazado y devuelto a su origen.";

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 8, fontSize: 13, textDecoration: "none",
    border: "1px solid #e5e5e5", color: active ? "#fff" : "#333",
    background: active ? "#111" : "#fff", fontWeight: 600,
  };
}

export function LabelPrintClient({ data, formato }: { data: LabelData; formato: LabelFormat }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const qrUrl = origin ? `${origin}${data.recordPath}` : "";

  const pageCss =
    formato === "envio" ? "@page { size: A4; margin: 0; }" : "@page { size: 100mm 150mm; margin: 0; }";

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            ${pageCss}
            @media print {
              .no-print { display: none !important; }
              html, body { background: #fff !important; }
              .print-canvas { background: #fff !important; padding: 0 !important; }
            }
            .qr-box svg { width: 100% !important; height: 100% !important; display: block; }
          `,
        }}
      />

      {/* Controles — solo en pantalla */}
      <div
        className="no-print"
        style={{
          position: "sticky", top: 0, zIndex: 10, display: "flex", gap: 8, alignItems: "center",
          padding: "10px 16px", borderBottom: "1px solid #e5e5e5", background: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <strong style={{ fontSize: 14 }}>Etiqueta {data.kind} · {data.code}</strong>
        <div style={{ flex: 1 }} />
        <a href="?f=etiqueta" style={tabStyle(formato === "etiqueta")}>Etiqueta 100×150</a>
        <a href="?f=envio" style={tabStyle(formato === "envio")}>Hoja A4 (envío)</a>
        <button
          onClick={() => window.print()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
            border: 0, background: "#ff592f", color: "#fff", fontWeight: 600, cursor: "pointer",
          }}
        >
          <Printer size={16} /> Imprimir
        </button>
      </div>

      <div
        className="print-canvas"
        style={{ display: "flex", justifyContent: "center", padding: "24px 0", background: "#f0f0f0", minHeight: "100vh" }}
      >
        {formato === "etiqueta" ? <Label100x150 data={data} qrUrl={qrUrl} /> : <ShippingSheet data={data} qrUrl={qrUrl} />}
      </div>
    </>
  );
}

function Label100x150({ data, qrUrl }: { data: LabelData; qrUrl: string }) {
  return (
    <div
      style={{
        width: "100mm", height: "150mm", boxSizing: "border-box", padding: "6mm", background: "#fff",
        display: "flex", flexDirection: "column", gap: "3mm", fontFamily: "system-ui, sans-serif",
        color: "#111", border: "1px solid #ddd",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2mm", color: "#212121" }}>
          <BrandMark size={22} />
          <span style={{ fontSize: "4.5mm", fontWeight: 800, letterSpacing: "-0.3px" }}>Qamarero</span>
        </div>
        <span style={{ fontSize: "3.2mm", fontWeight: 700, padding: "1mm 2.5mm", borderRadius: "2mm", background: "#111", color: "#fff" }}>
          {data.kind}
        </span>
      </div>

      <div style={{ fontSize: "8mm", fontWeight: 800, fontFamily: "ui-monospace, monospace", letterSpacing: "0.5px", textAlign: "center" }}>
        {data.code}
      </div>

      <div className="qr-box" style={{ width: "50mm", height: "50mm", margin: "0 auto" }}>
        {qrUrl && <QRCode value={qrUrl} size={256} style={{ width: "100%", height: "100%" }} />}
      </div>

      <div style={{ fontSize: "4.2mm", fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{data.device}</div>
      <div style={{ fontSize: "3.4mm", fontFamily: "ui-monospace, monospace", textAlign: "center", color: "#333" }}>
        {data.serial ? `S/N: ${data.serial}` : "S/N: —"}
      </div>

      <div style={{ marginTop: "auto", borderTop: "1px solid #eee", paddingTop: "2mm", fontSize: "3.2mm", display: "flex", flexDirection: "column", gap: "1mm" }}>
        {data.client && <div><strong>Cliente:</strong> {data.client}</div>}
        {data.provider && <div><strong>Proveedor:</strong> {data.provider}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", color: "#555" }}>
          <span>{data.statusLabel}</span>
          <span>{data.date}</span>
        </div>
      </div>
    </div>
  );
}

function ShippingSheet({ data, qrUrl }: { data: LabelData; qrUrl: string }) {
  return (
    <div
      style={{
        width: "210mm", minHeight: "297mm", boxSizing: "border-box", padding: "14mm", background: "#fff",
        fontFamily: "system-ui, sans-serif", color: "#111", border: "1px solid #ddd",
      }}
    >
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #111", paddingBottom: "5mm" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4mm" }}>
          <div style={{ color: "#212121", display: "flex" }}><BrandMark size={42} /></div>
          <div>
            <div style={{ fontSize: "6.5mm", fontWeight: 800, letterSpacing: "-0.3px" }}>Qamarero</div>
            <div style={{ fontSize: "5mm", fontWeight: 700 }}>Autorización de devolución (RMA)</div>
            <div style={{ fontSize: "3.5mm", color: "#555" }}>Hardware Support</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "6mm", fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>{data.code}</div>
          <div style={{ fontSize: "3.5mm", color: "#555" }}>{data.date}</div>
        </div>
      </div>

      {/* Datos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4mm", marginTop: "6mm", fontSize: "3.8mm" }}>
        <div><strong>Equipo:</strong> {data.device}</div>
        <div><strong>Nº de serie:</strong> {data.serial ?? "—"}</div>
        <div><strong>Cliente:</strong> {data.client ?? "—"}</div>
        <div><strong>Proveedor / destino:</strong> {data.provider ?? "—"}</div>
      </div>

      {/* Zona recortable */}
      <div style={{ marginTop: "8mm", border: "2px dashed #888", borderRadius: "3mm", padding: "7mm", position: "relative" }}>
        <div style={{ position: "absolute", top: "-3mm", left: "6mm", background: "#fff", padding: "0 2mm", fontSize: "3mm", color: "#888", fontWeight: 600 }}>
          ✂ Recortar y pegar en el equipo
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "9mm" }}>
          <div className="qr-box" style={{ width: "42mm", height: "42mm", flexShrink: 0 }}>
            {qrUrl && <QRCode value={qrUrl} size={256} style={{ width: "100%", height: "100%" }} />}
          </div>
          <div>
            <div style={{ fontSize: "9mm", fontWeight: 800, fontFamily: "ui-monospace, monospace", letterSpacing: "0.3px" }}>{data.code}</div>
            <div style={{ fontSize: "5mm", fontWeight: 700, marginTop: "1mm" }}>{data.device}</div>
            {data.serial && <div style={{ fontSize: "4mm", fontFamily: "ui-monospace, monospace", marginTop: "0.5mm" }}>S/N: {data.serial}</div>}
          </div>
        </div>
      </div>

      {/* Normas */}
      <div style={{ marginTop: "8mm" }}>
        <div style={{ fontSize: "4.5mm", fontWeight: 800, marginBottom: "3mm" }}>Condiciones para aceptar la recepción</div>
        <ol style={{ fontSize: "3.8mm", lineHeight: 1.6, paddingLeft: "5mm", margin: 0 }}>
          {NORMAS.map((n) => (
            <li key={n} style={{ marginBottom: "1.5mm" }}>{n}</li>
          ))}
        </ol>
        <div style={{ marginTop: "4mm", fontSize: "4mm", fontWeight: 800, lineHeight: 1.4, borderLeft: "3px solid #ff592f", paddingLeft: "3mm" }}>
          {AVISO_INCUMPLIMIENTO}
        </div>
        <div style={{ marginTop: "5mm", fontSize: "3.6mm", background: "#f5f5f5", borderRadius: "2mm", padding: "4mm", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: "1mm" }}>Dirección de recepción</div>
          <div>{RECEPCION.empresa}</div>
          <div>{RECEPCION.direccion}</div>
          <div>{RECEPCION.cpCiudad}</div>
          <div style={{ marginTop: "1.5mm", color: "#555" }}>Horario: {RECEPCION.horario} · Tel.: {RECEPCION.telefono} · {RECEPCION.contacto}</div>
        </div>
      </div>
    </div>
  );
}
