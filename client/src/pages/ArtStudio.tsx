import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { DesignEditor } from "@/components/DesignEditor";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCompanyAccess } from "@/_core/hooks/useCompanyAccess";
import { Palette, Pencil, Trash2, Download, Loader2, ImageOff } from "lucide-react";

type EditorTarget =
  | { kind: "template"; templateId: number; imageUrl: string; canvasJson: Record<string, unknown> | null }
  | { kind: "artwork"; templateId: number; artworkId: number; canvasJson: Record<string, unknown> };

export default function ArtStudio() {
  const { user, loading: authLoading } = useAuth();
  const { hasCompanyAccess, isLoading: accessLoading } = useCompanyAccess();
  const [, navigate] = useLocation();
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);

  const isAdmin = user?.role === "admin";
  const allowed = isAdmin || hasCompanyAccess;

  useEffect(() => {
    if (authLoading || accessLoading) return;
    if (!allowed) navigate("/dashboard");
  }, [authLoading, accessLoading, allowed, navigate]);

  const templatesQuery = trpc.artStudio.templates.list.useQuery(undefined, { enabled: allowed });
  const artworksQuery = trpc.artStudio.artworks.list.useQuery(undefined, { enabled: allowed });

  const saveArtwork = trpc.artStudio.artworks.save.useMutation({
    onSuccess: () => {
      toast.success("Arte salva!");
      artworksQuery.refetch();
      setEditorTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteArtwork = trpc.artStudio.artworks.delete.useMutation({
    onSuccess: () => { toast.success("Arte removida"); artworksQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading || accessLoading || !allowed) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const templates = templatesQuery.data ?? [];
  const artworks = artworksQuery.data ?? [];

  return (
    <AppLayout activeModule="artStudio">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Artes</h1>
            <p className="text-sm text-muted-foreground">Artes prontas da sua empresa — edite o texto e baixe.</p>
          </div>
        </div>

        {/* Biblioteca de templates */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Biblioteca</h2>
          {templatesQuery.isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : templates.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhuma arte disponível ainda. Assim que sua empresa tiver artes cadastradas, elas aparecem aqui.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map((tpl) => (
                <div key={tpl.id} className="glass-card rounded-xl overflow-hidden border border-border/40 group">
                  <div className="aspect-[4/5] bg-muted/40 relative overflow-hidden">
                    {tpl.thumbnailUrl || tpl.imageUrl ? (
                      <img src={tpl.thumbnailUrl ?? tpl.imageUrl} alt={tpl.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><ImageOff className="w-8 h-8" /></div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setEditorTarget({
                          kind: "template",
                          templateId: tpl.id,
                          imageUrl: tpl.imageUrl,
                          canvasJson: tpl.canvasJson,
                        })}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar texto
                      </Button>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium truncate">{tpl.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Minhas artes editadas */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Minhas artes</h2>
          {artworks.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
              As artes que você editar e salvar aparecem aqui.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {artworks.map((art) => (
                <div key={art.id} className="glass-card rounded-xl overflow-hidden border border-border/40">
                  <div className="aspect-[4/5] bg-muted/40">
                    <img src={art.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2.5 flex items-center gap-1.5">
                    <Button
                      size="sm" variant="outline" className="flex-1 gap-1.5 h-7 text-xs"
                      onClick={() => setEditorTarget({ kind: "artwork", templateId: art.templateId, artworkId: art.id, canvasJson: art.canvasJson })}
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                      <a href={art.imageUrl} download target="_blank" rel="noreferrer"><Download className="w-3.5 h-3.5" /></a>
                    </Button>
                    <Button
                      size="icon" variant="ghost" className={cn("h-7 w-7 text-destructive/60 hover:text-destructive")}
                      onClick={() => { if (confirm("Remover essa arte?")) deleteArtwork.mutate({ id: art.id }); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <DesignEditor
        open={!!editorTarget}
        onClose={() => setEditorTarget(null)}
        initialImageUrl={editorTarget?.kind === "template" ? editorTarget.imageUrl : undefined}
        initialCanvasJson={editorTarget?.canvasJson ?? null}
        onSave={(dataUrl, canvasJson) => {
          if (!editorTarget) return;
          saveArtwork.mutate({ templateId: editorTarget.templateId, canvasJson, imageDataUrl: dataUrl });
        }}
      />
    </AppLayout>
  );
}
