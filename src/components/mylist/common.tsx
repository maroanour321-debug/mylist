"use client";
// مكونات مشتركة صغيرة: صورة البوستر مع الحرف الأول + شارات الحالة والتصنيف
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CAT_COLOR, type ExportState } from "@/lib/mylist/types";
import { STATE_LABEL } from "@/lib/mylist/logic";
import { cn } from "@/lib/utils";

export function PosterImg({ src, title, className, onClick }: { src?: string; title: string; className?: string; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  const initial = (title || "؟").trim().charAt(0).toUpperCase();
  const show = src && !failed;
  return (
    <div
      className={cn("relative overflow-hidden bg-muted flex items-center justify-center select-none", onClick && "cursor-pointer", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? `صورة ${title}` : undefined}
    >
      {show ? (
         
        <img
          src={src}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-3xl font-extrabold text-primary/70">{initial}</span>
      )}
    </div>
  );
}

export function CatBadge({ category }: { category: string }) {
  const color = CAT_COLOR[category] || CAT_COLOR["مسلسل"];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow-sm" style={{ backgroundColor: color }}>
      {category}
    </span>
  );
}

export function StateBadge({ state, className }: { state: ExportState; className?: string }) {
  const styles: Record<ExportState, string> = {
    new: "bg-cyan-600 text-white",
    changed: "bg-amber-500 text-white",
    done: "bg-teal-600 text-white",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm", styles[state], className)}>
      {STATE_LABEL[state]}
    </span>
  );
}

export function EmptyState({ icon, title, sub, children }: { icon?: React.ReactNode; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-primary">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {sub && <p className="text-sm text-muted-foreground max-w-md">{sub}</p>}
      {children}
    </div>
  );
}

export { Badge };
