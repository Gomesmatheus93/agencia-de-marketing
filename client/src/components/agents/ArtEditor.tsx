import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Pencil, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Edição manual (sem IA) dos textos de uma arte feita pelos agentes: o servidor
// troca os textos no desenho e renderiza de novo, com o mesmo layout.

export type ArtTarget = { kind: "slide" | "frame" | "post"; index?: number };

export function ArtEditButton({ threadId, target, onSaved, className }: { threadId: number; target: ArtTarget; onSaved: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className={className ?? "gap-1.5"} onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" />Editar texto</Button>
      {open && <ArtTextDialog threadId={threadId} target={target} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

function ArtTextDialog({ threadId, target, onClose, onSaved }: { threadId: number; target: ArtTarget; onClose: () => void; onSaved: () => void }) {
  const utils = trpc.useUtils();
  const input = { threadId, target: { kind: target.kind, index: target.index ?? 0 } };
  const art = trpc.agents.artTexts.useQuery(input);
  const [draft, setDraft] = useState<Record<number, string>>({});
  useEffect(() => {
    if (art.data) setDraft(Object.fromEntries(art.data.texts.map((t) => [t.id, t.text])));
  }, [art.data]);

  const done = (message: string) => {
    toast.success(message);
    utils.agents.artTexts.invalidate(input);
    onSaved();
    onClose();
  };
  const save = trpc.agents.editArtText.useMutation({ onSuccess: () => done("Arte redesenhada com o texto novo"), onError: (e) => toast.error(e.message) });
  const undo = trpc.agents.undoArtEdit.useMutation({ onSuccess: () => done("Edição desfeita"), onError: (e) => toast.error(e.message) });

  const changed = (art.data?.texts ?? []).filter((t) => draft[t.id] !== undefined && draft[t.id] !== t.text);
  const busy = save.isPending || undo.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Editar texto da arte</DialogTitle></DialogHeader>
        {art.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Lendo a arte…</p>
        ) : !art.data?.editable ? (
          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">Esta arte foi feita antes da edição manual existir e o desenho dela não ficou guardado. Peça o ajuste ao agente ou gere de novo.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Cada campo é um texto da arte, na ordem do desenho (títulos em mais de uma linha aparecem linha por linha). Mantenha um tamanho parecido com o original: texto bem maior pode passar da borda. Confira a arte depois de salvar.</p>
            {art.data.texts.map((t, i) => (
              <label key={t.id} className="block space-y-1 text-xs font-medium text-muted-foreground">
                Texto {i + 1}
                {t.text.length > 60 ? (
                  <Textarea rows={2} value={draft[t.id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [t.id]: e.target.value }))} className="text-sm text-foreground" />
                ) : (
                  <Input value={draft[t.id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [t.id]: e.target.value }))} className="text-sm text-foreground" />
                )}
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {art.data?.canUndo ? (
            <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={() => undo.mutate(input)}><Undo2 className="h-3.5 w-3.5" />Desfazer última edição</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button disabled={busy || !changed.length} onClick={() => save.mutate({ ...input, texts: changed.map((t) => ({ id: t.id, text: draft[t.id] })) })}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar e redesenhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Editor da legenda e das hashtags (texto puro, sem IA). */
export function CaptionEditor({ threadId, caption, hashtags, onClose, onSaved }: { threadId: number; caption: string; hashtags: string[]; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(caption);
  const [tags, setTags] = useState(hashtags.join(" "));
  const save = trpc.agents.editCaption.useMutation({
    onSuccess: () => { toast.success("Legenda atualizada"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const tagList = tags.split(/\s+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`));
  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Editar legenda</DialogTitle></DialogHeader>
        <label className="block space-y-1 text-xs font-medium text-muted-foreground">Legenda
          <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} className="text-sm text-foreground" />
          <span className="block text-right">{text.length} / 2.200 caracteres</span>
        </label>
        <label className="block space-y-1 text-xs font-medium text-muted-foreground">Hashtags (separadas por espaço; até 5 é o recomendado)
          <Input value={tags} onChange={(e) => setTags(e.target.value)} className="text-sm text-foreground" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button disabled={save.isPending || !text.trim()} onClick={() => save.mutate({ threadId, caption: text, hashtags: tagList })}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar legenda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
