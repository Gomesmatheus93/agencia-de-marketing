import { CollaboratorsInput } from "@/components/CollaboratorsInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarClock, Clapperboard, Loader2, Send, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Publicar (ou programar) um vídeo motion no Instagram: feed (Reels, com legenda) e/ou story.

type Video = { id: number; title: string; caption: string | null; format: string };

export function MotionPublishDialog({ video, onClose, onDone }: { video: Video; onClose: () => void; onDone: () => void }) {
  const [feed, setFeed] = useState(video.format !== "landscape_16x9");
  const [story, setStory] = useState(video.format === "story_9x16");
  const [caption, setCaption] = useState(video.caption ?? "");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [mode, setMode] = useState<"agora" | "programar">("programar");
  const [when, setWhen] = useState("");
  const publish = trpc.motion.publish.useMutation({
    onSuccess: ({ results }) => {
      for (const r of results) {
        const label = r.target === "feed" ? "Feed (Reels)" : "Story";
        if (r.status === "published") toast.success(`${label}: publicado`);
        else if (r.status === "scheduled") toast.success(`${label}: programado`);
        else toast.error(`${label}: não publicou. ${r.error ?? ""}`);
      }
      onDone(); onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const storyWarn = story && video.format !== "story_9x16";
  const feedWarn = feed && video.format === "landscape_16x9";
  const ok = (feed || story) && (!feed || caption.trim().length > 0) && (mode === "agora" || Boolean(when));

  const Option = ({ on, set, icon: Icon, title, desc }: { on: boolean; set: (v: boolean) => void; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) => (
    <button type="button" onClick={() => set(!on)} className={cn("flex flex-1 items-start gap-3 rounded-xl border p-3 text-left transition", on ? "border-primary bg-primary/5" : "hover:border-primary/40")}>
      <input type="checkbox" checked={on} readOnly className="mt-1" />
      <span><span className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</span><span className="block text-xs text-muted-foreground">{desc}</span></span>
    </button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Publicar no Instagram</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{video.title}</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Onde postar</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Option on={feed} set={setFeed} icon={Clapperboard} title="Feed" desc="Sai como Reels, com legenda e marcação." />
            <Option on={story} set={setStory} icon={Smartphone} title="Story" desc="O vídeo no story (some em 24 h, sem legenda)." />
          </div>
          {storyWarn && <p className="text-xs text-amber-600">O story é 9:16. Este vídeo é {video.format === "landscape_16x9" ? "horizontal" : "de feed"}: o Instagram vai mostrar com faixas. Para story, use um vídeo 9:16.</p>}
          {feedWarn && <p className="text-xs text-amber-600">Vídeo horizontal no feed sai como Reels com faixas. O ideal é 9:16 ou 4:5.</p>}
        </div>

        {feed && (
          <>
            <label className="block space-y-1 text-xs font-medium">Legenda do feed
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} maxLength={2200} placeholder="Escreva a legenda do Reels" />
            </label>
            <div className="space-y-1 text-xs font-medium">Colaboradores (opcional)<CollaboratorsInput value={collaborators} onChange={setCollaborators} /></div>
          </>
        )}
        {story && !feed && <p className="text-xs text-muted-foreground">Figurinhas (enquete, link, perguntas) não entram pela API do Instagram: se precisar, adicione pelo app.</p>}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quando</p>
          <div className="flex gap-2">
            {(["programar", "agora"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded-lg border px-3 py-2 text-sm", mode === m ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40")}>
                {m === "programar" ? <><CalendarClock className="mr-1.5 inline h-4 w-4" />Programar</> : <><Send className="mr-1.5 inline h-4 w-4" />Publicar agora</>}
              </button>
            ))}
          </div>
          {mode === "programar" && <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" />}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!ok || publish.isPending} className="gap-2"
            onClick={() => { if (mode === "agora" && !confirm("Publicar agora no Instagram?")) return; publish.mutate({ id: video.id, feed, story, caption: caption || undefined, when: mode === "agora" ? null : new Date(when).toISOString(), collaborators }); }}>
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "agora" ? <Send className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
            {mode === "agora" ? "Publicar agora" : "Programar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
