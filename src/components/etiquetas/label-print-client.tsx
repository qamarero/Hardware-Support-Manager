"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Printer } from "lucide-react";

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

/** Condiciones de recepción para la hoja A4 de envío (borrador editable). */
const NORMAS = [
  "El envío debe llevar un nº de RMA autorizado (RMA-AAAA-NNNNN) visible en el exterior del bulto. Sin nº de RMA no se acepta la recepción.",
  "Pega la etiqueta recortable de esta hoja en el propio equipo.",
  "Envía el equipo en su embalaje original o uno equivalente que evite daños durante el transporte.",
  "Incluye todos los accesorios (cargador, cables, soportes, etc.).",
  "Indica el nº de seguimiento del envío para poder localizarlo.",
];

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-qamarero.svg" alt="Qamarero" style={{ height: "8mm" }} />
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-qamarero.svg" alt="Qamarero" style={{ height: "12mm" }} />
          <div>
            <div style={{ fontSize: "6mm", fontWeight: 800 }}>Autorización de devolución (RMA)</div>
            <div style={{ fontSize: "3.5mm", color: "#555" }}>Hardware Support · Qamarero</div>
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
      <div style={{ marginTop: "8mm", border: "2px dashed #888", borderRadius: "3mm", padding: "5mm", position: "relative" }}>
        <div style={{ position: "absolute", top: "-3mm", left: "6mm", background: "#fff", padding: "0 2mm", fontSize: "3mm", color: "#888", fontWeight: 600 }}>
          ✂ Recortar y pegar en el equipo
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6mm" }}>
          <div className="qr-box" style={{ width: "32mm", height: "32mm", flexShrink: 0 }}>
            {qrUrl && <QRCode value={qrUrl} size={256} style={{ width: "100%", height: "100%" }} />}
          </div>
          <div>
            <div style={{ fontSize: "7mm", fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>{data.code}</div>
            <div style={{ fontSize: "4mm", fontWeight: 600 }}>{data.device}</div>
            {data.serial && <div style={{ fontSize: "3.5mm", fontFamily: "ui-monospace, monospace" }}>S/N: {data.serial}</div>}
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
        <div style={{ marginTop: "5mm", fontSize: "3.6mm", background: "#f5f5f5", borderRadius: "2mm", padding: "4mm" }}>
          <strong>Recepción:</strong> [Dirección de Qamarero] · Horario: [—] · Contacto: hardware@qamarero.com
        </div>
      </div>
    </div>
  );
}
