import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Crop, Download, Loader2, Maximize2, Square, Smartphone, Monitor } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";

type ReformatFormat = "square" | "portrait" | "story";

const FORMAT_OPTIONS: { id: ReformatFormat; label: string; dims: string; icon: React.ElementType; ratio: string }[] = [
  { id: "square",   label: "Feed Quadrado",  dims: "1080 × 1080px", icon: Square,    ratio: "aspect-square" },
  { id: "portrait", label: "Feed Retrato",   dims: "1080 × 1350px", icon: Monitor,   ratio: "aspect-[4/5]" },
  { id: "story",    label: "Story / Reels",  dims: "1080 × 1920px", icon: Smartphone, ratio: "aspect-[9/16]" },
];

function resolveImgUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  return url;
}

export default function Resize() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [format, setFormat] = useState<ReformatFormat>("story");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const { data: images = [], refetch } = trpc.images.getAll.useQuery();

  const reformatMut = trpc.images.reformat.useMutation({
    onSuccess: (data) => {
      toast.success("Imagem redimensionada com IA!");
      setResultUrl((data as unknown as { displayUrl?: string; imageUrl?: string }).displayUrl ?? (data as unknown as { imageUrl?: string }).imageUrl ?? null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedImage = images.find((img) => img.id === selectedId);

  function handleReformat() {
    if (!selectedId) { toast.error("Selecione uma imagem primeiro"); return; }
    setResultUrl(null);
    reformatMut.mutate({ id: selectedId, format });
  }

  function handleDownload(url: string) {
    const a = document.createElement("a");
    a.href = url; a.download = `imagem-${format}.png`; a.click();
  }

  return (
    <AppLayout activeModule="resize">
      <div className="flex h-full min-h-screen bg-background">
        {/* Sidebar */}
        <div className="w-80 min-w-[260px] border-r border-border flex flex-col h-screen sticky top-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Crop className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-foreground">Redimensionar Imagens</h1>
                <p className="text-[11px] text-muted-foreground">Outpaint com IA para qualquer formato</p>
              </div>
            </div>
          </div>

          {/* Format selector */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Formato de saída</p>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => { setFormat(opt.id); setResultUrl(null); }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      format === opt.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      format === opt.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground">{opt.dims}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Suas imagens</p>
            {images.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma imagem gerada ainda.<br />Use o módulo "Gerar Imagens" primeiro.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => { setSelectedId(img.id); setResultUrl(null); }}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                      selectedId === img.id ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                    )}
                  >
                    <img
                      src={resolveImgUrl(img.imageUrl)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    {selectedId === img.id && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Crop className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border">
            <Button
              className="w-full"
              onClick={handleReformat}
              disabled={!selectedId || reformatMut.isPending}
            >
              {reformatMut.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redimensionando com IA...</>
              ) : (
                <><Maximize2 className="w-4 h-4 mr-2" />Redimensionar</>
              )}
            </Button>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {resultUrl ? (
            <div className="flex flex-col items-center gap-6 max-w-lg w-full">
              <div className="text-center">
                <h2 className="text-lg font-bold text-foreground mb-1">Resultado</h2>
                <p className="text-sm text-muted-foreground">
                  {FORMAT_OPTIONS.find(f => f.id === format)?.label} — {FORMAT_OPTIONS.find(f => f.id === format)?.dims}
                </p>
              </div>
              <div className={cn(
                "w-full rounded-2xl overflow-hidden border border-border shadow-lg",
                FORMAT_OPTIONS.find(f => f.id === format)?.ratio
              )}>
                <img src={resolveImgUrl(resultUrl)} alt="resultado" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => handleDownload(resultUrl)}>
                  <Download className="w-4 h-4 mr-2" />Baixar
                </Button>
                <Button variant="outline" onClick={() => setResultUrl(null)}>
                  Novo redimensionamento
                </Button>
              </div>
            </div>
          ) : selectedImage ? (
            <div className="flex flex-col items-center gap-6 max-w-md w-full">
              <div className="text-center">
                <h2 className="text-lg font-bold text-foreground mb-1">Imagem selecionada</h2>
                <p className="text-sm text-muted-foreground">Escolha o formato à esquerda e clique em Redimensionar</p>
              </div>
              <div className="relative">
                <div className="aspect-square w-64 rounded-2xl overflow-hidden border border-border shadow">
                  <img src={resolveImgUrl(selectedImage.imageUrl)} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-3 -right-3 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                  → {FORMAT_OPTIONS.find(f => f.id === format)?.label}
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                A IA vai preencher as áreas extras com conteúdo gerado (outpaint) para adaptar a imagem ao novo formato sem distorcer.
              </p>
              {reformatMut.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Expandindo a imagem com IA...
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Crop className="w-10 h-10 text-cyan-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2">Redimensionamento Inteligente</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Selecione uma imagem na barra lateral, escolha o formato de destino e a IA vai expandir a imagem para preencher as bordas — sem cortar, sem distorcer.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full mt-2">
                {FORMAT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <div key={opt.id} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30 border border-border">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-foreground">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.dims}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
