"use client";
// نافذة "تجربة": معاينة السيرفرات في iframes بتبويبات + رسالة لو السيرفر مبيردش (زي صفحة المعاينة)
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExternalLink, Timer } from "lucide-react";
import type { PreviewServer } from "@/lib/mylist/store";

export function PreviewDialog() {
  const dialog = useStore((s) => s.dialogs.preview);
  const setDialog = useStore((s) => s.setDialog);
  if (!dialog) return null;
  const close = (): void => setDialog("preview", null);

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      {dialog.open && dialog.servers.length > 0 && (
        <PreviewInner key={dialog.title + dialog.servers.length} title={dialog.title} servers={dialog.servers} />
      )}
    </Dialog>
  );
}

function PreviewInner({ title, servers }: { title: string; servers: PreviewServer[] }) {
  const setDialog = useStore((s) => s.setDialog);
  const close = (): void => setDialog("preview", null);
  const [current, setCurrent] = useState(() => {
    const first = servers.findIndex((s) => s.enabled);
    return first >= 0 ? first : 0;
  });
  const [pending, setPending] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => setPending(false), 12000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const cur = servers[current];

  return (
    <>
      <DialogContent className="sm:max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>معاينة — {title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {servers.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-bold border transition-all",
                i === current ? "bg-primary text-primary-foreground border-primary shadow" : "bg-card border-border hover:bg-secondary",
                s.enabled === false && "opacity-45 line-through"
              )}
            >
              {s.name}
              {s.enabled === false ? " (مقفول)" : ""}
            </button>
          ))}
        </div>
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-border">
          {cur && (
            <iframe
              key={`${current}-${cur.url}`}
              src={cur.url}
              className="w-full h-full border-0"
              allowFullScreen
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
              title={`سيرفر ${cur.name}`}
              onLoad={() => setPending(false)}
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {pending ? (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <Timer className="w-3.5 h-3.5" /> لو السيرفر مش ظاهر بعد شوية يبقى غالباً بيمنع العرض داخل صفحات تانية…
              </span>
            ) : (
              "لو السيرفر مش بيظهر، الموقع غالباً بيمنع العرض داخل صفحات تانية — استخدم «فتح في تبويب جديد»."
            )}
          </p>
          {cur && (
            <Button variant="outline" size="sm" className="rounded-full shrink-0" onClick={() => window.open(cur.url, "_blank", "noopener")}>
              <ExternalLink className="w-3.5 h-3.5 me-1" /> فتح في تبويب جديد
            </Button>
          )}
        </div>
      </DialogContent>
    </>
  );
}
