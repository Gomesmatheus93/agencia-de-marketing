import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { FileBarChart2, Printer, TrendingUp, Image, FileText, GalleryHorizontal, Share2, Users, Heart, Eye, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function Report() {
  const { data: profile } = trpc.analytics.getInstagramConnectionStatus.useQuery();
  const { data: insights } = trpc.analytics.getInsights.useQuery({ days: 30 }, { retry: false });
  const { data: imgStats } = trpc.images.getStats.useQuery();
  const { data: articleStats } = trpc.articles.getStats.useQuery();
  const { data: posts = [] } = trpc.posts.getAll.useQuery({});
  const { data: carousels = [] } = trpc.carousel.getAll.useQuery();

  const publishedPosts = posts.filter((p) => (p as unknown as { status: string }).status === "published").length;
  const scheduledPosts = posts.filter((p) => (p as unknown as { status: string }).status === "scheduled").length;

  const totalReach     = Number((insights as unknown as { totalReach?: number })?.totalReach ?? 0);
  const totalImpressoes = Number((insights as unknown as { totalImpressions?: number })?.totalImpressions ?? 0);
  const avgEngagement  = Number((insights as unknown as { avgEngagementRate?: number })?.avgEngagementRate ?? 0);
  const totalLikes     = Number((insights as unknown as { totalLikes?: number })?.totalLikes ?? 0);
  const followers      = Number((profile as unknown as { followersCount?: number })?.followersCount ?? 0);

  const now = new Date();
  const rawMonthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

  function handlePrint() {
    window.print();
  }

  return (
    <AppLayout activeModule="report">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { background: white !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-6 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <FileBarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Relatório de Resultados</h1>
              <p className="text-sm text-muted-foreground">Exportável para PDF — use Ctrl+P / Cmd+P</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* Report content */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          {/* Report header */}
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 p-8 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-violet-200 text-sm font-medium mb-1">Relatório Mensal de Marketing</p>
                <h2 className="text-3xl font-bold mb-1">{monthName}</h2>
                {profile && (profile as unknown as { username?: string }).username && (
                  <p className="text-violet-200">@{(profile as unknown as { username?: string }).username}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-4xl font-black">{followers > 0 ? followers.toLocaleString("pt-BR") : "—"}</div>
                <div className="text-violet-200 text-sm">seguidores</div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Métricas Instagram */}
            <section>
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-500" />
                Performance do Instagram — últimos 30 dias
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Alcance total" value={totalReach > 0 ? totalReach.toLocaleString("pt-BR") : "—"} icon={Users} color="bg-blue-500" />
                <StatCard label="Impressões" value={totalImpressoes > 0 ? totalImpressoes.toLocaleString("pt-BR") : "—"} icon={Eye} color="bg-cyan-500" />
                <StatCard label="Curtidas" value={totalLikes > 0 ? totalLikes.toLocaleString("pt-BR") : "—"} icon={Heart} color="bg-pink-500" />
                <StatCard label="Engajamento médio" value={avgEngagement > 0 ? `${avgEngagement.toFixed(2)}%` : "—"} icon={TrendingUp} color="bg-emerald-500" />
              </div>
              {!insights && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Conecte sua conta do Instagram em Analytics para ver dados de performance.
                </p>
              )}
            </section>

            <hr className="border-border" />

            {/* Produção de conteúdo */}
            <section>
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <GalleryHorizontal className="w-5 h-5 text-amber-500" />
                Produção de Conteúdo com IA
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Imagens geradas" value={imgStats?.count ?? 0} icon={Image} color="bg-blue-500" />
                <StatCard label="Artigos criados" value={articleStats?.count ?? 0} icon={FileText} color="bg-emerald-500" />
                <StatCard label="Carrosséis criados" value={carousels.length} icon={GalleryHorizontal} color="bg-amber-500" />
                <StatCard label="Posts publicados" value={publishedPosts} icon={Share2} color="bg-violet-500" />
              </div>
            </section>

            <hr className="border-border" />

            {/* Status de publicações */}
            <section>
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-orange-500" />
                Status das Publicações
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Publicados", value: publishedPosts, color: "bg-emerald-500", bar: "bg-emerald-500" },
                  { label: "Agendados", value: scheduledPosts, color: "bg-blue-500", bar: "bg-blue-500" },
                  { label: "Total de posts", value: posts.length, color: "bg-violet-500", bar: "bg-violet-500" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-36">{item.label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", item.bar)}
                        style={{ width: posts.length > 0 ? `${Math.round((item.value / posts.length) * 100)}%` : "0%" }}
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground w-8 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-border" />

            {/* Observações / recomendações */}
            <section>
              <h3 className="text-base font-bold text-foreground mb-4">Observações do Período</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Pontos positivos</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    {publishedPosts > 0 && <li>{publishedPosts} post{publishedPosts > 1 ? "s" : ""} publicado{publishedPosts > 1 ? "s" : ""} no período</li>}
                    {(imgStats?.count ?? 0) > 0 && <li>{imgStats?.count} imagem{(imgStats?.count ?? 0) > 1 ? "ns" : ""} criada{(imgStats?.count ?? 0) > 1 ? "s" : ""} com IA</li>}
                    {avgEngagement > 3 && <li>Taxa de engajamento acima da média</li>}
                    {carousels.length > 0 && <li>{carousels.length} carrossel{carousels.length > 1 ? "is" : ""} gerado{carousels.length > 1 ? "s" : ""}</li>}
                    {publishedPosts === 0 && (imgStats?.count ?? 0) === 0 && <li>Plataforma configurada e pronta para uso</li>}
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-1">Próximos passos</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    {scheduledPosts > 0 && <li>{scheduledPosts} post{scheduledPosts > 1 ? "s" : ""} já agendado{scheduledPosts > 1 ? "s" : ""}</li>}
                    <li>Manter frequência mínima de 3 posts/semana</li>
                    <li>Usar carrosséis para maximizar alcance orgânico</li>
                    <li>Testar Reels com roteiro de IA para maior alcance</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Footer do relatório */}
            <div className="pt-4 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                Relatório gerado automaticamente pela plataforma KrythosLab · {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
