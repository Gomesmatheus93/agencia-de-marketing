import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Image,
  Sparkles,
  Download,
  Trash2,
  Loader2,
  Wand2,
  X,
  ZoomIn,
  Copy,
  ImagePlus,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const promptSuggestions = [
  "Logo minimalista para agência de marketing digital, estilo Apple",
  "Banner profissional para LinkedIn com gradiente azul e roxo",
  "Post Instagram com design moderno para lançamento de produto",
  "Ilustração abstrata para campanha de marketing, cores vibrantes",
  "Foto de produto em fundo branco, iluminação profissional",
  "Infográfico moderno sobre marketing digital",
];

export default function Images() {
  const utils = trpc.useUtils();
  const [prompt, setPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ id: number; imageUrl: string; prompt: string } | null>(null);

  const { data: images = [], isLoading } = trpc.images.getAll.useQuery();
  const { data: webhookSettings } = trpc.settings.getWebhooks.useQuery();

  const generateMutation = trpc.images.generate.useMutation({
    onSuccess: () => {
      utils.images.getAll.invalidate();
      utils.images.getStats.invalidate();
      toast.success("Imagem gerada com sucesso!");
      setPrompt("");
    },
    onError: (err) => {
      toast.error("Erro ao gerar imagem: " + err.message);
    },
  });

  const deleteMutation = trpc.images.delete.useMutation({
    onSuccess: () => {
      utils.images.getAll.invalidate();
      utils.images.getStats.invalidate();
      toast.success("Imagem excluída");
      if (selectedImage) setSelectedImage(null);
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message),
  });

  const handleGenerate = () => {
    if (!prompt.trim()) { toast.error("Digite um prompt para gerar a imagem"); return; }
    generateMutation.mutate({
      prompt: prompt.trim(),
      useWebhook: !!webhookSettings?.n8nImageWebhookUrl,
    });
  };

  const handleDownload = async (url: string, promptText: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `ai-image-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("Download iniciado!");
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Prompt copiado!");
  };

  return (
    <AppLayout activeModule="images">
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
              <Image className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Geração de Imagens</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Crie imagens com <span className="gradient-text">Inteligência Artificial</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Descreva a imagem que deseja criar e a IA irá gerá-la para você.
          </p>
        </div>

        {/* Generator */}
        <div className="glass-card p-6 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Novo prompt</h2>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva a imagem que você quer criar... Ex: 'Logo minimalista para startup de tecnologia com cores azul e branco'"
            className="resize-none min-h-[100px] glass border-border/50 focus:border-primary/50 rounded-xl text-sm"
            disabled={generateMutation.isPending}
          />

          {/* Suggestions */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Sugestões de prompts:</p>
            <div className="flex flex-wrap gap-2">
              {promptSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-accent/60 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-150"
                >
                  {s.slice(0, 40)}...
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            {webhookSettings?.n8nImageWebhookUrl && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Usando webhook n8n
              </div>
            )}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateMutation.isPending}
              className="ml-auto gradient-primary text-white border-0 hover:opacity-90 gap-2 shadow-md"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Imagem
                </>
              )}
            </Button>
          </div>

          {/* Loading preview */}
          {generateMutation.isPending && (
            <div className="rounded-xl overflow-hidden border border-border/30">
              <div className="aspect-square max-w-xs mx-auto shimmer flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-muted-foreground/40 animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground">Gerando sua imagem...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gallery */}
        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm text-foreground">
                Galeria <span className="text-muted-foreground font-normal">({images.length})</span>
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square shimmer rounded-2xl" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 opacity-40">
                <Image className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Nenhuma imagem ainda</h3>
              <p className="text-sm text-muted-foreground">Gere sua primeira imagem com IA acima</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className="group relative aspect-square rounded-2xl overflow-hidden glass-card cursor-pointer animate-fade-in-up hover:scale-[1.02] transition-all duration-300"
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => setSelectedImage(img)}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-white text-[10px] line-clamp-2">{img.prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl glass-card border-border/50 p-0 overflow-hidden">
          {selectedImage && (
            <div className="flex flex-col">
              <div className="relative">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full max-h-[60vh] object-contain bg-black/5"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full glass flex items-center justify-center hover:bg-black/20 transition-all"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedImage.prompt}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(selectedImage.imageUrl, selectedImage.prompt)}
                    className="flex-1 gap-2 gradient-primary text-white border-0 hover:opacity-90"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyPrompt(selectedImage.prompt)}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Prompt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => deleteMutation.mutate({ id: selectedImage.id })}
                    className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
