"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

export type SlaLevel = "ok" | "warn" | "overdue" | "paused";

export interface PostItData {
  id: string;
  ref: string; // INC-… / RMA-…
  href: string;
  title: string;
  status: string;
  meta?: string; // cliente / proveedor
  slaLevel: SlaLevel;
}

export interface BoardColumn {
  id: string;
  label: string;
  paused?: boolean;
}

interface CorkBoardProps {
  columns: BoardColumn[];
  cards: PostItData[];
  /** Devuelve true si el movimiento es válido (state machine). */
  canMove: (from: string, to: string) => boolean;
  onMove: (id: string, from: string, to: string) => void;
}

// Colores de post-it por urgencia de SLA. Papeles cálidos sobre corcho.
const PAPER: Record<SlaLevel, { bg: string; pin: string }> = {
  ok: { bg: "#d9f2c4", pin: "#4a9e2f" }, // verde papel
  warn: { bg: "#ffe9a8", pin: "#e0a000" }, // ámbar papel
  overdue: { bg: "#ffc4c0", pin: "#d63a30" }, // rojo papel
  paused: { bg: "#e6e0d2", pin: "#9a9484" }, // papel atenuado (en pausa)
};

// Rotación determinista por id (±2.5°) — no salta entre renders.
function rotationFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return ((h / 1000) * 5 - 2.5);
}

function PostIt({ data, dragging }: { data: PostItData; dragging?: boolean }) {
  const paper = PAPER[data.slaLevel];
  const rot = rotationFor(data.id);
  return (
    <div
      className="relative select-none rounded-[2px] px-3 pb-3 pt-5"
      style={{
        background: paper.bg,
        boxShadow: dragging
          ? "0 12px 24px rgba(0,0,0,0.35)"
          : "0 3px 6px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(0,0,0,0.04)",
        transform: dragging ? "rotate(0deg) scale(1.03)" : `rotate(${rot}deg)`,
        color: "#2b2b2b",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Chincheta */}
      <span
        className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rounded-full"
        style={{
          background: paper.pin,
          boxShadow: "0 1px 2px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.5)",
        }}
      />
      {/* Esquina doblada */}
      <span
        className="absolute bottom-0 right-0 h-3 w-3"
        style={{ background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.12) 50%)" }}
      />
      <p className="font-mono text-[10px] font-bold opacity-70">{data.ref}</p>
      <p className="mt-0.5 line-clamp-2 text-[12px] font-semibold leading-snug">{data.title}</p>
      {data.meta && <p className="mt-1 text-[10px] opacity-70">{data.meta}</p>}
    </div>
  );
}

function DraggablePostIt({ data }: { data: PostItData }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: data.id,
    data: { status: data.status },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <Link href={data.href} onClick={(e) => e.stopPropagation()} draggable={false}>
        <PostIt data={data} />
      </Link>
    </div>
  );
}

function BoardZone({ column, children, count }: { column: BoardColumn; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div
      ref={setNodeRef}
      className="flex min-h-[420px] w-[230px] shrink-0 flex-col rounded-lg p-2 transition-colors"
      style={{
        background: isOver
          ? "rgba(255,255,255,0.18)"
          : column.paused
            ? "rgba(3,112,221,0.10)"
            : "rgba(0,0,0,0.10)",
        outline: isOver ? "2px dashed rgba(255,255,255,0.6)" : "none",
        outlineOffset: -2,
        // Columnas de pausa: rayado azulado tenue
        backgroundImage: column.paused
          ? "repeating-linear-gradient(45deg, rgba(3,112,221,0.05) 0 6px, transparent 6px 12px)"
          : undefined,
      }}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/90 drop-shadow">
          {column.label}
        </span>
        <span className="ml-auto rounded bg-black/25 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white/90">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-1">{children}</div>
    </div>
  );
}

export function CorkBoard({ columns, cards, canMove, onMove }: CorkBoardProps) {
  const [active, setActive] = useState<PostItData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleStart = useCallback(
    (e: DragStartEvent) => {
      const card = cards.find((c) => c.id === e.active.id);
      if (card) setActive(card);
    },
    [cards]
  );

  const handleEnd = useCallback(
    (e: DragEndEvent) => {
      setActive(null);
      const { active: a, over } = e;
      if (!over) return;
      const id = a.id as string;
      const from = (a.data.current?.status as string) ?? "";
      const to = over.id as string;
      if (from === to) return;
      if (!canMove(from, to)) return;
      onMove(id, from, to);
    },
    [canMove, onMove]
  );

  const byColumn = (status: string) => cards.filter((c) => c.status === status);

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
      {/* Tablero de corcho — estética cálida, siempre (ignora el tema). */}
      <div
        className="overflow-x-auto rounded-2xl p-4"
        style={{
          background: "#b07a42",
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.13) 1px, transparent 1.4px), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1.4px)",
          backgroundSize: "7px 7px, 11px 11px",
          backgroundPosition: "0 0, 3px 5px",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
          border: "10px solid #6e4a25",
        }}
      >
        <div className="flex gap-3">
          {columns.map((col) => {
            const colCards = byColumn(col.id);
            return (
              <BoardZone key={col.id} column={col} count={colCards.length}>
                {colCards.map((c) => (
                  <DraggablePostIt key={c.id} data={c} />
                ))}
              </BoardZone>
            );
          })}
        </div>
      </div>

      <DragOverlay>{active ? <PostIt data={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
