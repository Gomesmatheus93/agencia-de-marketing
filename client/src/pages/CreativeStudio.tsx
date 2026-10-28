import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { usePlan } from "@/_core/hooks/usePlan";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Bot, Clapperboard, Crop, FileText, Film, GalleryHorizontal, Image, Layers3, LayoutGrid, Lock, Wrench,
} from "lucide-react";
import { Link } from "wouter";

// Ferramentas manuais (sem agente). As versões com agente ficam no menu "Criar".
const GROUPS = [
  {
    title: "Visual",
    tools: [
      { id: "carousel", title: "Editor de carrosséis", description: "Monte e edite slides à mão, com templates e ajuste fino.", path: "/dashboard/carousel", icon: GalleryHorizontal },
      { id: "images", title: "Imagens com IA", description: "Gere imagens a partir de um texto (depende de créditos na OpenAI).", path: "/dashboard/images", icon: Image },
      { id: "resize", title: "Redimensionar", description: "Adapte peças prontas para outros formatos e canais.", path: "/dashboard/resize", icon: Crop },
      { id: "artStudio", title: "Biblioteca de artes", description: "Modelos e peças salvas da empresa.", path: "/dashboard/artes", icon: LayoutGrid },
    ],
  },
  {
    title: "Vídeo",
    tools: [
      { id: "videos", title: "Vídeos com avatar", description: "Vídeos com avatar e fala (HeyGen / D-ID).", path: "/dashboard/videos", icon: Clapperboard },
      { id: "reels", title: "Roteiros para Reels (manual)", description: "Estruture ganchos, cenas e falas sem o agente.", path: "/dashboard/reels", icon: Film },
    ],
  },
  {
    title: "Conteúdo",
    tools: [
      { id: "articles", title: "Artigos e SEO", description: "Artigos completos, newsletter e resumo diário por WhatsApp.", path: "/dashboard/articles", icon: FileText },
      { id: "stories", title: "Sequências de Stories (manual)", description: "Narrativas rápidas montadas sem o agente.", path: "/dashboard/stories", icon: Layers3 },
    ],
  },
];

const AGENT_SHORTCUTS = [
  { label: "Carrossel", path: "/dashboard/criar/carrossel" },
  { label: "Post", path: "/dashboard/criar/post" },
  { label: "Stories", path: "/dashboard/criar/stories" },
  { label: "Vídeo com IA", path: "/dashboard/criar/video" },
  { label: "Reels", path: "/dashboard/agents/reels" },
];

export default function CreativeStudio() {
  const { isLocked } = usePlan();

  return (
    <AppLayout activeModule="studio">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1300px] space-y-7">
          <header>
            <Badge variant="outline" className="mb-2"><Wrench className="mr-1.5 h-3 w-3" />Ferramentas manuais</Badge>
            <h1 className="text-3xl font-bold tracking-tight">Mais ferramentas</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Os editores e geradores da plataforma, para quando você quiser fazer à mão ou ajustar algo que um agente criou.</p>
          </header>

          <Card className="border-primary/20 bg-primary/[.04]">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <p className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4 text-primary" />Quer que um agente faça a peça inteira (texto, arte e revisão)?</p>
              <div className="flex flex-wrap gap-2">
                {AGENT_SHORTCUTS.map((s) => (
                  <Link key={s.path} href={s.path} className="rounded-full border border-primary/30 bg-background px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10">{s.label}</Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {group.tools.map((tool) => {
                  const Icon = tool.icon;
                  const locked = isLocked(tool.id);
                  return (
                    <Link key={tool.id} href={locked ? "/dashboard" : tool.path} className={cn("group block", locked && "opacity-60")}>
                      <Card className="h-full border-border/60 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                        <CardContent className="flex h-full flex-col p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-foreground/70" /></div>
                            {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <h3 className="mt-3 font-semibold">{tool.title}</h3>
                          <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{tool.description}</p>
                          <p className="mt-3 flex items-center text-xs font-semibold text-primary">
                            {locked ? "Disponível no plano Pro" : "Abrir"}<ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </AppLayout>
  );
}
