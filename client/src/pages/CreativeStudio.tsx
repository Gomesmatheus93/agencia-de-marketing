import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlan } from "@/_core/hooks/usePlan";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Clapperboard, Crop, FileText, Film, GalleryHorizontal,
  Image, Layers3, LayoutGrid, Lock, Palette, Sparkles,
} from "lucide-react";
import { Link } from "wouter";

const tools = [
  { id: "images", title: "Imagens com IA", description: "Crie imagens para anúncios, redes sociais e campanhas.", path: "/dashboard/images", icon: Image, color: "from-blue-500 to-cyan-500", tag: "Visual" },
  { id: "carousel", title: "Carrosséis", description: "Gere sequências educativas e comerciais para redes sociais.", path: "/dashboard/carousel", icon: GalleryHorizontal, color: "from-amber-500 to-orange-500", tag: "Social" },
  { id: "articles", title: "Artigos e SEO", description: "Produza artigos completos a partir de temas e notícias.", path: "/dashboard/articles", icon: FileText, color: "from-emerald-500 to-teal-500", tag: "Conteúdo" },
  { id: "videos", title: "Vídeos com IA", description: "Crie vídeos com avatar e fala para sua comunicação.", path: "/dashboard/videos", icon: Clapperboard, color: "from-fuchsia-500 to-rose-500", tag: "Vídeo" },
  { id: "reels", title: "Roteiros para Reels", description: "Estruture hooks, cenas, falas e chamadas para ação.", path: "/dashboard/reels", icon: Film, color: "from-red-500 to-pink-500", tag: "Vídeo" },
  { id: "stories", title: "Sequências de Stories", description: "Monte narrativas rápidas para relacionamento e conversão.", path: "/dashboard/stories", icon: Layers3, color: "from-pink-500 to-rose-500", tag: "Social" },
  { id: "resize", title: "Redimensionar", description: "Adapte peças existentes para diferentes formatos e canais.", path: "/dashboard/resize", icon: Crop, color: "from-cyan-500 to-blue-500", tag: "Utilitário" },
];

export default function CreativeStudio() {
  const { isLocked } = usePlan();

  return (
    <AppLayout activeModule="studio">
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/.09),transparent_30%),radial-gradient(circle_at_top_right,hsl(210_90%_60%/.07),transparent_28%)] p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-7">
          <header className="overflow-hidden rounded-3xl border border-primary/10 bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl"><Badge variant="outline" className="mb-3 border-primary/20 bg-primary/5 text-primary"><Sparkles className="mr-1.5 h-3 w-3" />Produção em um só lugar</Badge><h1 className="text-3xl font-bold tracking-tight md:text-4xl">Estúdio Criativo</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">Escolha o formato que precisa produzir. Seus editores continuam completos e agora estão organizados dentro de um fluxo mais simples.</p></div>
              <div className="grid grid-cols-2 gap-3 text-center"><div className="rounded-2xl border bg-background/70 px-5 py-4"><p className="text-2xl font-bold">{tools.length}</p><p className="text-xs text-muted-foreground">ferramentas</p></div><div className="rounded-2xl border bg-background/70 px-5 py-4"><p className="text-2xl font-bold">1</p><p className="text-xs text-muted-foreground">fluxo criativo</p></div></div>
            </div>
          </header>

          <section><div className="mb-4"><h2 className="text-lg font-semibold">O que você quer criar?</h2><p className="text-sm text-muted-foreground">Todas as ferramentas originais permanecem disponíveis.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{tools.map((tool) => { const Icon = tool.icon; const locked = isLocked(tool.id); return <Link key={tool.id} href={locked ? "/dashboard" : tool.path} className={cn("group block", locked && "opacity-65")}><Card className="h-full overflow-hidden border-border/60 bg-card/80 transition duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl"><CardContent className="p-5"><div className="flex items-start justify-between"><div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md", tool.color)}><Icon className="h-5 w-5" /></div>{locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Badge variant="secondary" className="text-[10px]">{tool.tag}</Badge>}</div><h3 className="mt-5 font-semibold">{tool.title}</h3><p className="mt-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{tool.description}</p><div className="mt-5 flex items-center text-xs font-semibold text-primary">{locked ? "Disponível no plano Pro" : "Abrir ferramenta"}<ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></div></CardContent></Card></Link>; })}</div></section>

          <section className="grid gap-4 lg:grid-cols-2"><Card className="border-violet-500/15 bg-violet-500/[.04]"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-violet-500/10 p-3"><Palette className="h-5 w-5 text-violet-500" /></div><div className="flex-1"><h3 className="text-sm font-semibold">Comece pela identidade da marca</h3><p className="mt-1 text-xs text-muted-foreground">Cores, fontes e contexto deixam as criações mais consistentes.</p></div><Button variant="outline" size="sm" asChild><Link href="/dashboard/brand">Brand Kit</Link></Button></CardContent></Card><Card className="border-blue-500/15 bg-blue-500/[.04]"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-blue-500/10 p-3"><LayoutGrid className="h-5 w-5 text-blue-500" /></div><div className="flex-1"><h3 className="text-sm font-semibold">Biblioteca de artes</h3><p className="mt-1 text-xs text-muted-foreground">Acesse modelos e peças salvas sem alterar os editores.</p></div><Button variant="outline" size="sm" asChild><Link href="/dashboard/artes">Abrir artes</Link></Button></CardContent></Card></section>
        </div>
      </main>
    </AppLayout>
  );
}
