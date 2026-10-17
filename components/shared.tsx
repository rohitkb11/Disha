"use client";
import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  ArrowUpRight,
  BookOpen,
  Palette,
  Sprout,
  Heart,
  MessageCircle,
  Wallet,
  Compass,
  Briefcase,
} from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export const ICONS: Record<string, typeof BookOpen> = {
  digital: BookOpen,
  communication: MessageCircle,
  money: Wallet,
  design: Palette,
  care: Heart,
  green: Sprout,
  business: Briefcase,
  pathways: Compass,
};
export function CourseIcon({ id, size = 26 }: { id: string; size?: number }) {
  const Icon = ICONS[id] || BookOpen;
  return <Icon size={size} strokeWidth={1.65} />;
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <Compass size={34} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}
export function SourceLink({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}) {
  return (
    <a
      className="source-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${value}%` }} />
    </div>
  );
}
