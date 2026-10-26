"use client";
// نافذة "لصق": لو حلقة محددة = إضافة سيرفرات لها؛ لو موسم = لصق ذكي بيوزع بالأرقام/الترتيب
import { useEffect, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ClipboardPaste } from "lucide-react";
import { seasonName } from "@/lib/mylist/sqlbuilder";
import { isSeriesCat } from "@/lib/mylist/logic";

export function PasteDialog() {
  const dialog = useStore((s) => s.dialogs.paste);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const saveWork = useStore((s) => s.saveWork);
  const { toast } = useToast();
  const [text, setText] = useState("");
  const work = works.find((w) => w.id === dialog?.workId) || null;
  const season = work?.seasons.find((s) => s.number === dialog?.seasonNo) || null;

  useEffect(() => {
    if (dialog?.open) setText("");
  }, [dialog?.open]);

  if (!dialog) return null;
  const close = (): void => setDialog("paste", null);
  if (!work || !season) return <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}><DialogContent className="hidden" /></Dialog>;

  const perEpisode = dialog.epNo !== null;

  const ok = async (): Promise<void> => {
    const next = JSON.parse(JSON.stringify(work)) as typeof work;
    const sn = next.seasons.find((x) => x.number === season.number);
    if (!sn) return;
    if (perEpisode) {
      const ep = sn.episodes.find((e) => e.number === dialog.epNo);
      if (!ep) return;
      const urls = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
      if (!urls.length) {
        toast({ title: "مفيش لينكات في اللي لزيقته" });
        return;
      }
      const { setEpisodeServers, episodeRawServers, episodeServers } = await import("@/lib/mylist/urls");
      const existing = new Set(episodeServers(ep, true).map((x) => x.url));
      const merged = [...episodeRawServers(ep), ...urls.filter((u) => !existing.has(u)).map((u) => ({ url: u, name: "" }))];
      setEpisodeServers(ep, merged);
      const added = urls.length;
      const saved = await saveWork(next);
      if (saved) toast({ title: `اتضاف ${added} لينك للحلقة ${ep.number}` });
    } else {
      const { fillSmart } = await import("@/lib/mylist/text");
      const { filled, numbered } = fillSmart(sn, text);
      const saved = await saveWork(next);
      if (saved) {
        toast({
          title: filled ? `اتملت ${filled} حلقة` : "مفيش لينكات اتلقطت",
          description: filled ? (numbered ? "(توزيع بالأرقام)" : "(توزيع بالترتيب)") : "اكتب «حلقة 5» قدّام اللينك أو سيب سطر فاضي بين المجموعات",
          variant: filled ? undefined : "destructive",
        });
      }
    }
    close();
  };

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {perEpisode ? `لصق لينكات على حلقة ${dialog.epNo}` : `لصق لينكات كتير — ${isSeriesCat(work.category) ? seasonName(season.number) : "الفيلم"}`}
          </DialogTitle>
          <DialogDescription>
            {perEpisode
              ? "اللينكات بتتضاف على الحلقة دي (مش بتمسح الموجود)، وكل لينك بيبقى سيرفر."
              : "اكتب «حلقة 5» / «EP05» / «ح5» / «#5» قدّام اللينك وهيروح للحلقة الصح. من غير أرقام = توزيع بالترتيب. سطر فاضي بيفصل المجموعات. الأرقام العربي ٠-٩ شغالة."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>اللينكات</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            dir="auto"
            placeholder={perEpisode ? "https://…\nhttps://…" : "حلقة 1\nhttps://…\n\nحلقة 2\nhttps://…\nhttps://…"}
            className="font-mono text-xs leading-6"
          />
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                setText((prev) => (prev ? prev + "\n" + t : t));
              } catch {
                toast({ title: "مقدرتش أقرا الحافظة" });
              }
            }}
          >
            <ClipboardPaste className="w-3.5 h-3.5 me-1" /> لصق من الحافظة
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
          <Button onClick={() => void ok()} className="rounded-full px-6">
            توزيع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
