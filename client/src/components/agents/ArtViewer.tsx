import { AgentArtEditor, CaptionEditor, type ArtTarget } from "@/components/agents/ArtEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useViewerAccess } from "@/_core/hooks/useLimitedAccess";
import { Loader2, Paintbrush, Pencil } from "lucide-react";
import { useState } from "react";

type Art = { imageUrl?: string | null };
type Result = { title?: string; slides?: Art[]; frames?: Art[]; imageUrl?: string | null; caption?: string; hashtags?: string[] };

/**
 * Mostra todas as artes de um conteúdo criado (todos os slides do carrossel,
 * todos os stories ou o post) com a legenda, e deixa editar cada arte e a
 * legenda. Usado pela conta restrita, que não abre as telas de criação.
 */
export function ArtViewer({ threadId, onClose, onSaved }: { threadId: number; onClose: () => void; onSaved?: () => void }) {
  const utils = trpc.useUtils();
  // Visualizador só olha: sem editar arte nem legenda.
  const readOnly = useViewerAccess();
  const task = trpc.agents.task.useQuery({ threadId }, { refetchOnWindowFocus: false });
  const [editingCaption, setEditingCaption] = useState(false);
  // O editor de arte abre em tela cheia fora da janela; a janela some enquanto ele está aberto.
  const [editingArt, setEditingArt] = useState<ArtTarget | null>(null);
  const result = (task.data?.thread.result ?? null) as Result | null;

  const arts: Array<{ url: string; target: ArtTarget; label: string }> = result?.slides
    ? result.slides.map((s, i) => ({ url: s.imageUrl ?? "", target: { kind: "slide", index: i }, label: `Slide ${i + 1}` }))
    : result?.frames
      ? result.frames.map((f, i) => ({ url: f.imageUrl ?? "", target: { kind: "frame", index: i }, label: `Story ${i + 1}` }))
      : result?.imageUrl ? [{ url: result.imageUrl, target: { kind: "post" }, label: "Post" }] : [];

  const saved = () => {
    void task.refetch();
    void utils.agents.planOutputs.invalidate();
    void utils.dashboard.invalidate();
    onSaved?.();
  };

  return (
    <>
    {editingArt && !readOnly && <AgentArtEditor threadId={threadId} target={editingArt} onClose={() => setEditingArt(null)} onSaved={saved} />}
    <Dialog open={!editingArt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader><DialogTitle>{result?.title ?? task.data?.thread.title ?? "Conteúdo"}</DialogTitle></DialogHeader>
        {task.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !arts.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Este conteúdo ainda não tem arte.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {arts.map((a, i) => (
              <div key={`${i}-${a.url}`} className="space-y-2">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border bg-muted" title="Abrir em tamanho real">
                  <img src={a.url} alt={a.label} loading="lazy" className="w-full" />
                </a>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{a.label}</span>
                  {!readOnly && <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setEditingArt(a.target)}><Paintbrush className="h-3.5 w-3.5" />Editar arte</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {result?.caption && (
          <div className="space-y-2 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Legenda</p>
              {!readOnly && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditingCaption(true)}><Pencil className="h-3.5 w-3.5" />Editar</Button>}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.caption}</p>
            {!!result.hashtags?.length && <p className="text-sm text-primary">{result.hashtags.join(" ")}</p>}
          </div>
        )}
        {editingCaption && !readOnly && result?.caption && (
          <CaptionEditor threadId={threadId} caption={result.caption} hashtags={result.hashtags ?? []} onClose={() => setEditingCaption(false)} onSaved={saved} />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
