"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}

/** Drawer lateral derecho — markup/clases del prototipo (.drawer*). */
export function Drawer({ open, onClose, title, subtitle, footer, width = 720, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={{ width: `min(${width}px, 100vw)` }}>
        <div className="drawer__header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="drawer__title">{title}</h2>
            {subtitle && <div className="drawer__subtitle">{subtitle}</div>}
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__footer">{footer}</div>}
      </div>
    </>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      {children}
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}
