import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import type { RadarPrefill } from "@/pages/Radar";
const RADAR_PREFILL_KEY = "radar_prefill";
import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Plus,
  X,
  Send,
  Lightbulb,
  Clock,
  Flag,
  ImageIcon,
  RefreshCw,
  MessageCircle,
  Wand2,
  Copy,
  CheckCheck,
  Camera,
  BookOpen,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Zap,
  GalleryHorizontal,
} from "lucide-react";
import { usePlan } from "@/_core/hooks/usePlan";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Holiday,
  type HolidayType,
  getHolidaysForYear,
  HOLIDAY_TYPE_LABELS,
  HOLIDAY_TYPE_COLORS,
} from "@/lib/holidays";
import type { SocialPost } from "@shared/types";
import { toSchedulerDatetimeLocalValue } from "@/lib/scheduling";
import { SafeImage } from "@/components/SafeImage";

function resolveImgUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  if (typeof window !== "undefined") return new URL(url, window.location.origin).toString();
  return url;
}

// ── Channel config ────────────────────────────────────────────────────────────

type Channel = "instagram" | "linkedin" | "newsletter";

const CHANNEL_CONFIG: Record<Channel, { label: string; dot: string; bar: string; text: string }> = {
  instagram: {
    label: "Instagram",
    dot: "bg-pink-500",
    bar: "border-l-pink-500",
    text: "text-pink-600 dark:text-pink-400",
  },
  linkedin: {
    label: "LinkedIn",
    dot: "bg-blue-600",
    bar: "border-l-blue-600",
    text: "text-blue-700 dark:text-blue-400",
  },
  newsletter: {
    label: "Newsletter",
    dot: "bg-emerald-500",
    bar: "border-l-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
};

const POST_STATUS_CONFIG = {
  draft: { label: "Rascunho", dot: "bg-zinc-400" },
  scheduled: { label: "Agendado", dot: "bg-sky-500" },
  published: { label: "Publicado", dot: "bg-emerald-500" },
  failed: { label: "Falhou", dot: "bg-red-500" },
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function fmt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function buildCalendarGrid(viewDate: Date): Date[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Monday-start: Mon=0 … Sun=6
  let startOffset = firstOfMonth.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  let endOffset = 7 - lastOfMonth.getDay();
  if (endOffset === 7) endOffset = 0;

  const days: Date[] = [];
  for (let i = startOffset; i > 0; i--) days.push(new Date(year, month, 1 - i));
  for (let d = 1; d <= lastOfMonth.getDate(); d++) days.push(new Date(year, month, d));
  for (let i = 1; i <= endOffset; i++) days.push(new Date(year, month + 1, i));

  while (days.length < 42) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return days;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const WEEK_DAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// ── Channel icons ─────────────────────────────────────────────────────────────

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  if (channel === "instagram") return <InstagramIcon className={className} />;
  if (channel === "linkedin") return <LinkedinIcon className={className} />;
  return <MailIcon className={className} />;
}

// ── Legend ────────────────────────────────────────────────────────────────────

const HOLIDAY_BAR_COLORS: Record<HolidayType, string> = {
  national: "bg-green-500",
  state: "bg-teal-500",
  municipal: "bg-amber-500",
  international: "bg-purple-500",
  commemorative: "bg-rose-500",
};

function Legend() {
  const types: HolidayType[] = ["national", "state", "municipal", "international", "commemorative"];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
        Legenda
      </span>
      {types.map((type) => (
        <div key={type} className="flex items-center gap-1.5">
          <span className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", HOLIDAY_BAR_COLORS[type])} />
          <span className="text-xs text-muted-foreground">{HOLIDAY_TYPE_LABELS[type]}</span>
        </div>
      ))}
      <div className="w-px h-3 bg-border mx-1 hidden sm:block" />
      {(["instagram", "linkedin", "newsletter"] as Channel[]).map((ch) => (
        <div key={ch} className="flex items-center gap-1.5">
          <span className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", CHANNEL_CONFIG[ch].dot)} />
          <span className="text-xs text-muted-foreground">{CHANNEL_CONFIG[ch].label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Day Cell ──────────────────────────────────────────────────────────────────

const HOLIDAY_EVENT_COLORS: Record<HolidayType, string> = {
  national: "border-l-green-500 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300",
  state: "border-l-teal-500 bg-teal-50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-300",
  municipal: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300",
  international: "border-l-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300",
  commemorative: "border-l-rose-500 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300",
};

const CHANNEL_EVENT_COLORS: Record<Channel, string> = {
  instagram: "border-l-pink-500 bg-pink-50 dark:bg-pink-950/20 text-pink-800 dark:text-pink-300",
  linkedin: "border-l-blue-600 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300",
  newsletter: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300",
};

type PlanItem = {
  id: number;
  scheduledDate: string;
  format: string;
  category: string;
  suggestedTitle: string;
  pauta: string;
  status: string;
  socialPostId: number | null;
};

const PLAN_FORMAT_COLORS: Record<string, string> = {
  carousel: "border-l-violet-500 bg-violet-50 dark:bg-violet-950/20 text-violet-800 dark:text-violet-300",
  instagram: "border-l-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/20 text-fuchsia-800 dark:text-fuchsia-300",
  linkedin: "border-l-sky-500 bg-sky-50 dark:bg-sky-950/20 text-sky-800 dark:text-sky-300",
  newsletter: "border-l-teal-500 bg-teal-50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-300",
};

function DayCell({
  date,
  isCurrentMonth,
  holidays,
  posts,
  planItems,
  isSelected,
  onClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  holidays: Holiday[];
  posts: SocialPost[];
  planItems?: PlanItem[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const today = isToday(date);
  const maxHolidays = 1;
  const maxPosts = 1;
  const maxPlanItems = 1;
  const extra = Math.max(0, holidays.length - maxHolidays) + Math.max(0, posts.length - maxPosts) + Math.max(0, (planItems?.length ?? 0) - maxPlanItems);

  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-[100px] p-1.5 text-left rounded-md transition-all duration-150 flex flex-col gap-1 w-full",
        isCurrentMonth
          ? "hover:bg-accent/50"
          : "opacity-40",
        isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
        today && !isSelected && "bg-primary/[0.04]"
      )}
    >
      {/* Day number */}
      <span
        className={cn(
          "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full self-start mb-0.5",
          today
            ? "bg-primary text-primary-foreground"
            : isCurrentMonth
            ? "text-foreground"
            : "text-muted-foreground"
        )}
      >
        {date.getDate()}
      </span>

      {/* Holiday events */}
      {holidays.slice(0, maxHolidays).map((h) => (
        <div
          key={h.id}
          className={cn(
            "border-l-[3px] pl-1.5 pr-1 py-0.5 rounded-r-sm text-[10px] font-medium leading-tight truncate w-full",
            HOLIDAY_EVENT_COLORS[h.type]
          )}
        >
          {h.name}
        </div>
      ))}

      {/* Post events */}
      {posts.slice(0, maxPosts).map((p) => (
        <div
          key={p.id}
          className={cn(
            "border-l-[3px] pl-1.5 pr-1 py-0.5 rounded-r-sm text-[10px] leading-tight truncate w-full",
            CHANNEL_EVENT_COLORS[p.channel as Channel]
          )}
        >
          {p.title || p.content.slice(0, 24)}
        </div>
      ))}

      {/* Plan item events */}
      {planItems?.slice(0, maxPlanItems).map((item) => (
        <div
          key={`plan-${item.id}`}
          className={cn(
            "border-l-[3px] border-dashed pl-1.5 pr-1 py-0.5 rounded-r-sm text-[10px] leading-tight truncate w-full opacity-80",
            PLAN_FORMAT_COLORS[item.format] ?? "border-l-violet-500 bg-violet-50 dark:bg-violet-950/20 text-violet-800 dark:text-violet-300"
          )}
          title={item.suggestedTitle}
        >
          {item.suggestedTitle.slice(0, 28)}
        </div>
      ))}

      {extra > 0 && (
        <span className="text-[10px] text-muted-foreground pl-1">
          +{extra} mais
        </span>
      )}
    </button>
  );
}

// ── Themes ────────────────────────────────────────────────────────────────────

const THEMES: Array<{ id: string; emoji: string; label: string; description: string; marketingTip: string; color: string }> = [
  {
    id: 'theme-religiao',
    emoji: '🙏',
    label: 'Religião & Fé',
    description: 'Conteúdo inspiracional sobre fé e espiritualidade',
    marketingTip: 'Crie conteúdo inspiracional sobre fé, gratidão e espiritualidade. Conecte valores espirituais com mensagens de esperança, propósito e comunidade. Use linguagem acolhedora e reflexiva.',
    color: 'from-amber-500/10 to-yellow-500/10 border-amber-500/30 hover:border-amber-500/60',
  },
  {
    id: 'theme-empreendedorismo',
    emoji: '💼',
    label: 'Empreendedorismo',
    description: 'Negócios, mindset e crescimento profissional',
    marketingTip: 'Crie conteúdo motivacional sobre negócios, crescimento e mindset empreendedor. Aborde temas como produtividade, liderança, inovação e cases de sucesso. Mostre como o produto/serviço transforma resultados.',
    color: 'from-blue-500/10 to-indigo-500/10 border-blue-500/30 hover:border-blue-500/60',
  },
  {
    id: 'theme-familia',
    emoji: '👨‍👩‍👧‍👦',
    label: 'Família',
    description: 'Vínculos familiares, lar e momentos especiais',
    marketingTip: 'Crie conteúdo emocional sobre família, vínculos e momentos especiais. Explore temas como amor, cumplicidade, rotina em família e memórias afetivas. Conecte o produto/serviço com o bem-estar e a felicidade familiar.',
    color: 'from-rose-500/10 to-pink-500/10 border-rose-500/30 hover:border-rose-500/60',
  },
  {
    id: 'theme-esporte',
    emoji: '⚽',
    label: 'Esporte',
    description: 'Performance, superação e vida ativa',
    marketingTip: 'Crie conteúdo dinâmico com energia esportiva, superação e performance. Use analogias de vitória, treino e conquista. Explore atletas, competições e hábitos saudáveis para engajar o público.',
    color: 'from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-500/60',
  },
  {
    id: 'theme-saude',
    emoji: '💪',
    label: 'Saúde & Bem-estar',
    description: 'Hábitos saudáveis, qualidade de vida e autocuidado',
    marketingTip: 'Crie conteúdo sobre saúde, autocuidado e qualidade de vida. Aborde hábitos saudáveis, alimentação, descanso e saúde mental. Conecte o produto/serviço com a jornada de bem-estar do público.',
    color: 'from-teal-500/10 to-cyan-500/10 border-teal-500/30 hover:border-teal-500/60',
  },
  {
    id: 'theme-educacao',
    emoji: '📚',
    label: 'Educação',
    description: 'Aprendizado, crescimento pessoal e conhecimento',
    marketingTip: 'Crie conteúdo educativo e de valor sobre aprendizado e crescimento pessoal. Compartilhe dicas, tutoriais, curiosidades e insights que agreguem valor real ao público-alvo.',
    color: 'from-purple-500/10 to-violet-500/10 border-purple-500/30 hover:border-purple-500/60',
  },
  {
    id: 'theme-humor',
    emoji: '😄',
    label: 'Humor',
    description: 'Leveza, entretenimento e conteúdo divertido',
    marketingTip: 'Crie conteúdo leve, divertido e com humor inteligente. Use memes, situações do cotidiano e piadas alinhadas à identidade da marca. Entretenimento que gera compartilhamento espontâneo.',
    color: 'from-orange-500/10 to-amber-500/10 border-orange-500/30 hover:border-orange-500/60',
  },
  {
    id: 'theme-sustentabilidade',
    emoji: '🌿',
    label: 'Sustentabilidade',
    description: 'Meio ambiente, responsabilidade e futuro',
    marketingTip: 'Crie conteúdo sobre sustentabilidade, responsabilidade ambiental e consumo consciente. Mostre o compromisso da marca com o futuro do planeta e engaje públicos que valorizam causas ambientais.',
    color: 'from-lime-500/10 to-green-500/10 border-lime-500/30 hover:border-lime-500/60',
  },
];

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  date,
  holidays,
  posts,
  onClose,
  onCreatePost,
}: {
  date: Date;
  holidays: Holiday[];
  posts: SocialPost[];
  onClose: () => void;
  onCreatePost: (holiday?: Holiday) => void;
}) {
  const dayNum = date.getDate();
  const weekDay = date.toLocaleDateString("pt-BR", { weekday: "long" });
  const monthYear = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/50">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-foreground leading-none">{dayNum}</span>
          <div className="pb-0.5">
            <p className="text-sm font-medium capitalize text-foreground leading-tight">{weekDay}</p>
            <p className="text-xs text-muted-foreground capitalize">{monthYear}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Holidays section */}
        {holidays.length > 0 && (
          <div className="px-5 py-4 space-y-3 border-b border-border/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Flag className="w-3 h-3" />
              Feriados e Datas Especiais
            </p>
            {holidays.map((h) => (
              <div key={h.id} className="space-y-2">
                <div className={cn("rounded-lg border p-3.5 space-y-2.5", HOLIDAY_TYPE_COLORS[h.type].card)}>
                  <div>
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{h.name}</span>
                      <span className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                        HOLIDAY_TYPE_COLORS[h.type].badge
                      )}>
                        {HOLIDAY_TYPE_LABELS[h.type]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {h.description}
                    </p>
                  </div>

                  <div className="flex items-start gap-2 bg-background/70 rounded-md p-2.5 border border-border/30">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {h.marketingTip}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5 font-medium"
                    onClick={() => onCreatePost(h)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar post sobre esta data
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Posts section */}
        {posts.length > 0 && (
          <div className="px-5 py-4 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Postagens — {posts.length}
            </p>
            {posts.map((p) => {
              const channel = p.channel as Channel;
              const status = p.status as keyof typeof POST_STATUS_CONFIG;
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-border bg-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ChannelIcon
                        channel={channel}
                        className={cn("w-3.5 h-3.5 flex-shrink-0", CHANNEL_CONFIG[channel].text)}
                      />
                      <span className="text-xs font-medium">{CHANNEL_CONFIG[channel].label}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className={cn("w-1.5 h-1.5 rounded-full", POST_STATUS_CONFIG[status]?.dot ?? "bg-zinc-400")} />
                      {POST_STATUS_CONFIG[status]?.label ?? status}
                    </span>
                  </div>

                  {p.title && (
                    <p className="text-xs font-semibold truncate text-foreground">{p.title}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {p.content}
                  </p>
                  {p.scheduledAt && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(p.scheduledAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {holidays.length === 0 && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-5">
            <CalendarDays className="w-9 h-9 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use o botão abaixo para criar uma postagem.
            </p>
          </div>
        )}
      </div>

        {/* Themes section */}
        <div className="px-5 py-4 border-t border-border/30">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
            <Sparkles className="w-3 h-3" />
            Criar por tema
          </p>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => onCreatePost({
                  id: theme.id,
                  name: theme.label,
                  type: 'commemorative',
                  description: theme.description,
                  marketingTip: theme.marketingTip,
                })}
                className={`flex items-center gap-2.5 rounded-xl border bg-gradient-to-br ${theme.color} px-3 py-2.5 text-left transition-all hover:shadow-sm`}
              >
                <span className="text-xl leading-none shrink-0">{theme.emoji}</span>
                <span className="text-[11px] font-medium text-foreground leading-tight">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-border/50">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 font-medium"
          onClick={() => onCreatePost(undefined)}
        >
          <Plus className="w-3.5 h-3.5" />
          Criar post para este dia
        </Button>
      </div>
    </div>
  );
}

// ── Image size by channel ─────────────────────────────────────────────────────

const IMAGE_SIZE_BY_CHANNEL: Record<Channel, "1:1" | "4:5" | "16:9"> = {
  instagram: "4:5",
  linkedin: "16:9",
  newsletter: "16:9",
};

function buildImagePrompt(holidayName: string, holidayDescription: string, channel: Channel): string {
  const format =
    channel === "instagram"
      ? "Instagram portrait post (4:5), visually impactful, thumb-stopping"
      : channel === "linkedin"
      ? "LinkedIn professional banner, wide format, corporate aesthetic"
      : "email newsletter header, wide format, clean editorial style";
  return `Create a professional marketing visual for "${holidayName}". Context: ${holidayDescription}. Platform: ${format}. The image must feel designed by a senior art director — strong composition, intentional color palette, no generic stock-photo look. No text overlays unless critical. High production value.`;
}

// ── Create Post Dialog ────────────────────────────────────────────────────────

function CreatePostDialog({
  open,
  onClose,
  holiday,
  prefillDate,
  initialImageDataUrl,
}: {
  open: boolean;
  onClose: () => void;
  holiday?: Holiday;
  prefillDate?: Date;
  initialImageDataUrl?: string;
}) {
  const utils = trpc.useUtils();
  const [channel, setChannel] = useState<Channel>("instagram");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState(initialImageDataUrl ?? "");
  const [displayImageUrl, setDisplayImageUrl] = useState(initialImageDataUrl ?? "");
  const [requireApproval, setRequireApproval] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const base = prefillDate ?? new Date();
    const d = new Date(base);
    d.setHours(12, 0, 0, 0);
    return toSchedulerDatetimeLocalValue(d);
  });

  const generateImageMutation = trpc.images.generate.useMutation({
    onSuccess: (data) => {
      setImageUrl(data.imageUrl ?? "");
      setDisplayImageUrl((data as { displayUrl?: string }).displayUrl ?? data.imageUrl ?? "");
      toast.success("Imagem gerada com sucesso.");
    },
    onError: (e) => toast.error("Erro ao gerar imagem: " + e.message),
  });

  const generateCaptionMutation = trpc.posts.generateContent.useMutation({
    onSuccess: (data) => {
      setContent(
        typeof data === "string" ? data : (data as { content?: string }).content ?? ""
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const approvalMutation = trpc.posts.sendForApproval.useMutation({
    onSuccess: () => {
      toast.success("Post enviado para aprovação no WhatsApp.");
      utils.posts.getAll.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.posts.create.useMutation({
    onSuccess: (post) => {
      if (requireApproval && post?.id) {
        approvalMutation.mutate({ id: post.id });
      } else {
        toast.success("Post criado com sucesso.");
        utils.posts.getAll.invalidate();
        onClose();
      }
    },
    onError: (e) => toast.error(e.message),
  });

  function handleGenerateImage() {
    const prompt = holiday
      ? buildImagePrompt(holiday.name, holiday.description, channel)
      : `Create a professional marketing visual for ${channel === "instagram" ? "Instagram" : channel === "linkedin" ? "LinkedIn" : "newsletter"}. Strong composition, intentional color palette, senior art director quality. No generic stock photo look.`;
    generateImageMutation.mutate({
      prompt,
      style: "social",
      size: IMAGE_SIZE_BY_CHANNEL[channel],
    });
  }

  function handleGenerateCaption() {
    const topic = holiday
      ? `${holiday.name}. ${holiday.description}`
      : "publicação institucional";
    generateCaptionMutation.mutate({ channel, topic, tone: "inspiring" });
  }

  function handleSubmit() {
    if (!content.trim()) {
      toast.error("Escreva a legenda do post.");
      return;
    }
    if (!imageUrl) {
      toast.error("Gere ou adicione uma imagem antes de continuar.");
      return;
    }
    createMutation.mutate({
      channel,
      content: content.trim(),
      imageUrl,
      scheduledAt,
    });
  }

  const maxChars = channel === "instagram" ? 2200 : channel === "linkedin" ? 3000 : 10000;
  const isGeneratingImage = generateImageMutation.isPending;
  const isGeneratingCaption = generateCaptionMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-base font-semibold">
          {holiday ? `Post sobre: ${holiday.name}` : "Nova postagem"}
        </DialogTitle>
        <DialogDescription className="text-xs leading-relaxed">
          {holiday
            ? holiday.marketingTip
            : "Crie e agende uma postagem para esta data."}
        </DialogDescription>

        <div className="space-y-5 pt-1">
          {/* Channel selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Canal</label>
            <div className="flex gap-2">
              {(Object.keys(CHANNEL_CONFIG) as Channel[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all flex-1 justify-center",
                    channel === ch
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  <ChannelIcon channel={ch} className="w-3.5 h-3.5" />
                  {CHANNEL_CONFIG[ch].label}
                </button>
              ))}
            </div>
          </div>

          {/* Image section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                Imagem
              </label>
              <Button
                size="sm"
                variant={imageUrl ? "outline" : "default"}
                className="h-7 text-xs gap-1.5 px-3"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : imageUrl ? (
                  <RefreshCw className="w-3 h-3" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {imageUrl ? "Gerar nova imagem" : "Gerar imagem com IA"}
              </Button>
            </div>

            {/* Image preview or placeholder */}
            {isGeneratingImage ? (
              <div className="w-full aspect-video rounded-xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-muted-foreground/50 animate-spin" />
                <p className="text-xs text-muted-foreground">Gerando imagem com IA...</p>
              </div>
            ) : imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <SafeImage
                  src={resolveImgUrl(displayImageUrl || imageUrl)}
                  alt="Imagem gerada para o post"
                  className={cn(
                    "w-full object-cover",
                    channel === "instagram" ? "aspect-[4/5]" : "aspect-video"
                  )}
                  fallbackClassName={channel === "instagram" ? "aspect-[4/5]" : "aspect-video"}
                />
              </div>
            ) : (
              <div className="w-full aspect-video rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2">
                <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground text-center px-4">
                  Clique em "Gerar imagem com IA" para criar uma imagem<br />
                  {holiday ? `sobre ${holiday.name}` : "personalizada"} para este post.
                </p>
              </div>
            )}
          </div>

          {/* Caption section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Legenda</label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs gap-1.5 text-primary hover:text-primary px-2"
                onClick={handleGenerateCaption}
                disabled={isGeneratingCaption}
              >
                {isGeneratingCaption
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Sparkles className="w-3 h-3" />}
                Gerar com IA
              </Button>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                holiday
                  ? `Escreva ou gere a legenda sobre ${holiday.name}...`
                  : "Escreva a legenda do post..."
              }
              className="min-h-[120px] text-sm resize-none"
              maxLength={maxChars}
            />
            <p
              className={cn(
                "text-[10px] text-right",
                content.length > maxChars * 0.9 ? "text-amber-500" : "text-muted-foreground"
              )}
            >
              {content.length} / {maxChars}
            </p>
          </div>

          {/* Scheduled date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Agendar para</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Approval toggle */}
          <button
            type="button"
            onClick={() => setRequireApproval((v) => !v)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-all",
              requireApproval
                ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                : "border-border hover:bg-accent/50"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              requireApproval ? "bg-green-500" : "bg-muted"
            )}>
              <MessageCircle className={cn("w-4 h-4", requireApproval ? "text-white" : "text-muted-foreground")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-medium", requireApproval ? "text-green-700 dark:text-green-400" : "text-foreground")}>
                Enviar para aprovação no WhatsApp
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {requireApproval
                  ? "Você receberá uma mensagem para aprovar antes de publicar"
                  : "Ative para revisar o post pelo WhatsApp antes de agendar"}
              </p>
            </div>
            <div className={cn(
              "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors",
              requireApproval ? "bg-green-500 border-green-500" : "border-muted-foreground/40"
            )} />
          </button>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSubmit}
              disabled={createMutation.isPending || approvalMutation.isPending || !content.trim() || !imageUrl}
            >
              {(createMutation.isPending || approvalMutation.isPending)
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : requireApproval
                ? <MessageCircle className="w-4 h-4" />
                : <Send className="w-4 h-4" />}
              {requireApproval ? "Enviar para aprovação" : scheduledAt ? "Agendar post" : "Salvar rascunho"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ── Campaign types ────────────────────────────────────────────────────────────

type CampaignResult = {
  creativeConcept?: string;
  artPrompt?: string;
  artCopy?: { title?: string; subtitle?: string; cta?: string; secondary?: string; badge?: string | null };
  caption?: string;
  stories?: Array<{ slide?: number; text?: string; cta?: string }>;
  reel?: { hook?: string; scene1?: string; scene2?: string; scene3?: string; closing?: string; cta?: string };
  carousel?: Array<{ slide?: number; title?: string; body?: string }>;
  variations?: {
    emotional?: { concept?: string; headline?: string; caption?: string };
    sales?: { concept?: string; headline?: string; caption?: string };
  };
  recommendations?: {
    bestTime?: string; audience?: string; adObjective?: string;
    campaignType?: string; segmentation?: string; keywords?: string[];
  };
};

function CampaignSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{label}</span>
      </div>
      <div className="p-4 text-sm text-foreground leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CampaignDialog({ open, date, onClose }: { open: boolean; date: Date; onClose: () => void }) {
  const [subject, setSubject] = React.useState('');
  const [client, setClient] = React.useState('');
  const [segment, setSegment] = React.useState('');
  const [objective, setObjective] = React.useState('');
  const [socialNetwork, setSocialNetwork] = React.useState('Instagram');
  const [extraInfo, setExtraInfo] = React.useState('');
  const [result, setResult] = React.useState<CampaignResult | null>(null);

  const generateMutation = trpc.campaign.generate.useMutation({
    onSuccess: (data) => setResult(data as CampaignResult),
    onError: (e) => toast.error(e.message || 'Erro ao gerar campanha'),
  });

  function handleGenerate() {
    if (!subject.trim()) { toast.error('Informe o assunto da campanha'); return; }
    setResult(null);
    generateMutation.mutate({
      subject: subject.trim(),
      client: client.trim() || undefined,
      segment: segment.trim() || undefined,
      date: date.toLocaleDateString('pt-BR'),
      objective: objective.trim() || undefined,
      socialNetwork: socialNetwork.trim() || undefined,
      extraInfo: extraInfo.trim() || undefined,
    });
  }

  function handleClose() {
    setSubject(''); setClient(''); setSegment(''); setObjective('');
    setSocialNetwork('Instagram'); setExtraInfo(''); setResult(null);
    onClose();
  }

  const isLoading = generateMutation.isPending;
  const r = result;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
          <Wand2 className="h-4 w-4 text-primary" />
          Campanha Completa
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          {date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} — preencha os dados e o agente criativo gera toda a campanha.
        </DialogDescription>

        {!r ? (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Assunto <span className="text-destructive">*</span></label>
              <Input placeholder='Promoção Renault Kwid, Lançamento produto X…' value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isLoading} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                <Input placeholder="Nome do cliente" value={client} onChange={(e) => setClient(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Segmento</label>
                <Input placeholder="Ex: Automóveis, Fitness, Tech" value={segment} onChange={(e) => setSegment(e.target.value)} disabled={isLoading} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Objetivo</label>
                <Input placeholder="Ex: Gerar leads, Engajamento" value={objective} onChange={(e) => setObjective(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Rede Social</label>
                <Input placeholder="Instagram, LinkedIn, TikTok…" value={socialNetwork} onChange={(e) => setSocialNetwork(e.target.value)} disabled={isLoading} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Informações adicionais</label>
              <Textarea
                placeholder="Identidade visual, cores, promoção, preço, detalhes extras…"
                rows={3}
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                disabled={isLoading}
                className="resize-none"
              />
            </div>
            <Button
              className="w-full gap-2 border-0 bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white hover:opacity-90"
              onClick={handleGenerate}
              disabled={isLoading || !subject.trim()}
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando campanha completa…</>
                : <><Sparkles className="h-4 w-4" />Gerar campanha completa</>}
            </Button>
            {isLoading && (
              <p className="text-center text-xs text-muted-foreground animate-pulse">
                O agente criativo está trabalhando: ideia criativa, prompt de arte, legenda, stories, reel, carrossel, variações e recomendações…
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setResult(null)}>
              <RefreshCw className="h-3.5 w-3.5" /> Nova geração
            </Button>

            {r.creativeConcept && (
              <CampaignSection label="1 · Ideia Criativa">
                <div className="flex items-start gap-2"><p className="flex-1">{r.creativeConcept}</p><CopyBtn text={r.creativeConcept} /></div>
              </CampaignSection>
            )}

            {r.artPrompt && (
              <CampaignSection label="2 · Prompt para Geração de Arte">
                <div className="flex items-start gap-2">
                  <p className="flex-1 font-mono text-xs bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{r.artPrompt}</p>
                  <CopyBtn text={r.artPrompt} />
                </div>
              </CampaignSection>
            )}

            {r.artCopy && (
              <CampaignSection label="3 · Texto da Arte">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {r.artCopy.title && <div><span className="font-semibold text-muted-foreground">Título: </span>{r.artCopy.title}</div>}
                  {r.artCopy.subtitle && <div><span className="font-semibold text-muted-foreground">Subtítulo: </span>{r.artCopy.subtitle}</div>}
                  {r.artCopy.cta && <div><span className="font-semibold text-muted-foreground">CTA: </span>{r.artCopy.cta}</div>}
                  {r.artCopy.secondary && <div><span className="font-semibold text-muted-foreground">Secundário: </span>{r.artCopy.secondary}</div>}
                  {r.artCopy.badge && <div className="col-span-2"><span className="font-semibold text-muted-foreground">Selo: </span>{r.artCopy.badge}</div>}
                </div>
              </CampaignSection>
            )}

            {r.caption && (
              <CampaignSection label="4 · Legenda">
                <div className="flex items-start gap-2"><p className="flex-1 whitespace-pre-wrap text-xs">{r.caption}</p><CopyBtn text={r.caption} /></div>
              </CampaignSection>
            )}

            {r.stories && r.stories.length > 0 && (
              <CampaignSection label="5 · Stories">
                <div className="space-y-2">
                  {r.stories.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {s.slide ?? i + 1}
                      </span>
                      <div className="flex-1 text-xs">
                        <p>{s.text}</p>
                        {s.cta && <p className="mt-1 font-semibold text-primary">{s.cta}</p>}
                      </div>
                      <CopyBtn text={(s.text ?? '') + (s.cta ? ('\n' + s.cta) : '')} />
                    </div>
                  ))}
                </div>
              </CampaignSection>
            )}

            {r.reel && (
              <CampaignSection label="6 · Roteiro de Reel (30s)">
                <div className="space-y-1.5 text-xs">
                  {([
                    ['Gancho (0-3s)', r.reel.hook],
                    ['Cena 1 (3-10s)', r.reel.scene1],
                    ['Cena 2 (10-18s)', r.reel.scene2],
                    ['Cena 3 (18-24s)', r.reel.scene3],
                    ['Encerramento (24-27s)', r.reel.closing],
                    ['CTA (27-30s)', r.reel.cta],
                  ] as [string, string | undefined][]).filter(([, v]) => v).map(([lbl, val], i) => (
                    <div key={i} className="flex gap-2">
                      <span className="shrink-0 font-semibold text-muted-foreground w-36">{lbl}</span>
                      <span className="flex-1">{val}</span>
                    </div>
                  ))}
                </div>
              </CampaignSection>
            )}

            {r.carousel && r.carousel.length > 0 && (
              <CampaignSection label="7 · Carrossel">
                <div className="space-y-2">
                  {r.carousel.map((s, i) => (
                    <div key={i} className="rounded-lg bg-muted/30 px-3 py-2 text-xs">
                      <p className="font-semibold text-foreground">Slide {s.slide ?? i + 1}{s.title ? ' — ' + s.title : ''}</p>
                      {s.body && <p className="mt-0.5 text-muted-foreground">{s.body}</p>}
                    </div>
                  ))}
                </div>
              </CampaignSection>
            )}

            {r.variations && (
              <CampaignSection label="8 · Variações">
                <div className="grid gap-3 sm:grid-cols-2">
                  {r.variations.emotional && (
                    <div className="rounded-lg border border-border/40 p-3 space-y-1.5">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-rose-500">Emocional</p>
                      {r.variations.emotional.headline && <p className="font-semibold text-sm">{r.variations.emotional.headline}</p>}
                      {r.variations.emotional.caption && <p className="text-xs text-muted-foreground line-clamp-4">{r.variations.emotional.caption}</p>}
                    </div>
                  )}
                  {r.variations.sales && (
                    <div className="rounded-lg border border-border/40 p-3 space-y-1.5">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-amber-500">Vendas</p>
                      {r.variations.sales.headline && <p className="font-semibold text-sm">{r.variations.sales.headline}</p>}
                      {r.variations.sales.caption && <p className="text-xs text-muted-foreground line-clamp-4">{r.variations.sales.caption}</p>}
                    </div>
                  )}
                </div>
              </CampaignSection>
            )}

            {r.recommendations && (
              <CampaignSection label="9 · Recomendações">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {r.recommendations.bestTime && <div><span className="font-semibold text-muted-foreground">Melhor horário: </span>{r.recommendations.bestTime}</div>}
                  {r.recommendations.audience && <div><span className="font-semibold text-muted-foreground">Público: </span>{r.recommendations.audience}</div>}
                  {r.recommendations.adObjective && <div><span className="font-semibold text-muted-foreground">Objetivo do anúncio: </span>{r.recommendations.adObjective}</div>}
                  {r.recommendations.campaignType && <div><span className="font-semibold text-muted-foreground">Tipo de campanha: </span>{r.recommendations.campaignType}</div>}
                  {r.recommendations.segmentation && <div className="col-span-2"><span className="font-semibold text-muted-foreground">Segmentação: </span>{r.recommendations.segmentation}</div>}
                  {r.recommendations.keywords && r.recommendations.keywords.length > 0 && (
                    <div className="col-span-2 flex flex-wrap gap-1.5 mt-1">
                      {r.recommendations.keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
              </CampaignSection>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


// ── Quote Card ────────────────────────────────────────────────────────────────

const QUOTE_FONTS = [
  { label: 'Inter', value: '"Inter", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
  { label: 'Merriweather', value: '"Merriweather", Georgia, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

async function renderQuoteCardToPng(
  quote: string,
  profilePhotoUrl: string,
  name: string,
  handle: string,
  fontFamily = '"Inter", Arial, sans-serif'
): Promise<string> {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  try { await document.fonts.load(`bold 62px ${fontFamily}`); } catch {}

  // Quote mark top-left
  ctx.fillStyle = '#111111';
  ctx.font = '220px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('”', 60, 240);

  // Wrap quote text
  ctx.font = `bold 62px ${fontFamily}`;
  const maxW = 880;
  const words = quote.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);

  const lh = 88;
  const blockH = lines.length * lh;
  const midY = H * 0.44;
  const startY = midY - blockH / 2 + lh;
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lh));

  // Separator
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(W / 2 - 100, H - 310, 200, 2);

  // Profile section — try loading photo
  const drawProfile = (photo: HTMLImageElement | null) => {
    const photoSize = 110;
    const sectionW = 320;
    const sectionX = (W - sectionW) / 2;
    const centerY = H - 210;

    if (photo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sectionX + photoSize / 2, centerY, photoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(photo, sectionX, centerY - photoSize / 2, photoSize, photoSize);
      ctx.restore();
      // Orange ring
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(sectionX + photoSize / 2, centerY, photoSize / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Initials placeholder
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(sectionX + photoSize / 2, centerY, photoSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name.charAt(0).toUpperCase(), sectionX + photoSize / 2, centerY + 16);
    }

    // Name
    const textX = sectionX + photoSize + 18;
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 38px "Inter", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(name, textX, centerY - 10);

    // Blue verified badge
    const nameW = ctx.measureText(name).width;
    const bx = textX + nameW + 8, by = centerY - 28;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(bx + 14, by, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(bx + 7, by); ctx.lineTo(bx + 12, by + 6); ctx.lineTo(bx + 21, by - 8);
    ctx.stroke();

    // Handle
    ctx.fillStyle = '#6b7280';
    ctx.font = '32px "Inter", Arial, sans-serif';
    ctx.fillText(handle, textX, centerY + 30);
  };

  return new Promise((resolve) => {
    if (!profilePhotoUrl) { drawProfile(null); resolve(canvas.toDataURL('image/png')); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { drawProfile(img); resolve(canvas.toDataURL('image/png')); };
    img.onerror = () => { drawProfile(null); resolve(canvas.toDataURL('image/png')); };
    img.src = profilePhotoUrl;
  });
}

function QuoteCardDialog({
  open,
  date,
  onClose,
  onUseImage,
}: {
  open: boolean;
  date: Date;
  onClose: () => void;
  onUseImage: (dataUrl: string) => void;
}) {
  const [quote, setQuote] = React.useState('');
  const [profileName, setProfileName] = React.useState('Flavio Vasconcelos');
  const [profileHandle, setProfileHandle] = React.useState('@comflavio');
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState('');
  const [fontFamily, setFontFamily] = React.useState('"Inter", Arial, sans-serif');
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    if (!document.getElementById('gf-quote-fonts')) {
      const link = document.createElement('link');
      link.id = 'gf-quote-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Merriweather:wght@400;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const bkQuery = trpc.brandKit.get.useQuery(undefined, { staleTime: 5 * 60_000, enabled: open });
  React.useEffect(() => {
    const bk = bkQuery.data;
    if (!bk) return;
    if (bk.companyName) setProfileName(bk.companyName);
    const raw = bk.instagramHandle ?? '';
    if (raw) setProfileHandle(raw.startsWith('@') ? raw : '@' + raw);
    const logo = (bk as unknown as Record<string, string>).logoUrl;
    if (logo) setProfilePhotoUrl(logo);
  }, [bkQuery.data]);

  async function handleUse() {
    if (!quote.trim()) return;
    setIsGenerating(true);
    try {
      const png = await renderQuoteCardToPng(quote.trim(), profilePhotoUrl, profileName, profileHandle, fontFamily);
      onUseImage(png);
    } catch { toast.error('Erro ao gerar arte'); }
    finally { setIsGenerating(false); }
  }

  function handleClose() { setQuote(''); onClose(); }

  const hasQuote = quote.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-none p-0 h-[90vh] max-h-[720px] overflow-hidden" style={{ width: 'min(92vw, 1100px)' }}>
        <div className="grid grid-cols-[1fr_420px] h-full">

          {/* LEFT — Form */}
          <div className="p-6 space-y-5 border-r border-border/50 overflow-y-auto">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold mb-1">
                <span>🙏</span> Arte de Citação
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </DialogDescription>
            </div>

            {/* Quote input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frase / Versículo</label>
              <Textarea
                placeholder="Ao dono dos meus dias consagro a minha semana, minha vida, meus sonhos e cada passo que eu der:"
                rows={5}
                value={quote}
                onChange={(e) => { setQuote(e.target.value); }}
                className="resize-none text-sm"
                style={{ fontFamily }}
              />
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[10px] text-muted-foreground whitespace-nowrap">Fonte:</label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_FONTS.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: f.value }}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Profile fields */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfil</label>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                <label className="relative w-12 h-12 rounded-full shrink-0 cursor-pointer group">
                  {profilePhotoUrl
                    ? <SafeImage src={profilePhotoUrl} className="w-12 h-12 rounded-full object-cover border-[3px] border-orange-400" alt="" fallbackClassName="rounded-full" />
                    : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-lg">
                        {profileName.charAt(0).toUpperCase()}
                      </div>}
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Nome do perfil"
                    className="h-7 text-xs font-semibold"
                  />
                  <Input
                    value={profileHandle}
                    onChange={(e) => setProfileHandle(e.target.value)}
                    placeholder="@handle"
                    className="h-7 text-xs text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">URL da foto (opcional)</label>
                <Input
                  value={profilePhotoUrl}
                  onChange={(e) => setProfilePhotoUrl(e.target.value)}
                  placeholder="https://... ou deixe vazio para usar iniciais"
                  className="h-7 text-xs"
                />
              </div>
            </div>

            <Button
              className="w-full gap-2 h-11 text-sm font-semibold border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-opacity"
              disabled={!hasQuote || isGenerating}
              onClick={handleUse}
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? 'Gerando arte…' : 'Usar esta arte no post'}
            </Button>
          </div>

          {/* RIGHT — Live preview */}
          <div className="bg-muted/20 p-5 flex flex-col overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Preview ao vivo</p>

            {/* Card preview — 4:5 ratio */}
            <div
              className="flex-1 rounded-2xl overflow-hidden shadow-lg border border-border/30"
              style={{ background: '#ffffff', fontFamily: '"Inter", Arial, sans-serif' }}
            >
              <div className="h-full flex flex-col p-7">
                {/* Quote mark */}
                <div
                  className="text-black font-black leading-none select-none"
                  style={{ fontSize: '88px', fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 0.8, letterSpacing: '-4px' }}
                >
                  &#8220;
                </div>

                {/* Quote text */}
                <div className="flex-1 flex items-center justify-center py-4">
                  {hasQuote ? (
                    <p
                      className="text-center font-bold text-black break-words"
                      style={{ fontSize: '18px', lineHeight: '1.55', maxWidth: '100%', fontFamily }}
                    >
                      {quote.trim()}
                    </p>
                  ) : (
                    <p className="text-center text-gray-300 italic" style={{ fontSize: '14px' }}>
                      A frase aparece aqui…
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="flex justify-center mb-4">
                  <div style={{ width: '60px', height: '1px', background: '#e5e7eb' }} />
                </div>

                {/* Profile */}
                <div className="flex items-center justify-center gap-2.5">
                  {profilePhotoUrl ? (
                    <SafeImage
                      src={profilePhotoUrl}
                      alt=""
                      className="rounded-full object-cover shrink-0"
                      fallbackClassName="rounded-full"
                      style={{ width: '44px', height: '44px', border: '3px solid #f97316' }}
                    />
                  ) : (
                    <div
                      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
                      style={{ width: '44px', height: '44px', border: '3px solid #f97316', background: 'linear-gradient(135deg, #fb923c, #f59e0b)', fontSize: '18px' }}
                    >
                      {profileName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-black flex items-center gap-1" style={{ fontSize: '13px' }}>
                      {profileName}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6" style={{ display: 'inline', verticalAlign: 'middle' }}>
                        <circle cx="12" cy="12" r="12"/>
                        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </p>
                    <p className="text-gray-500" style={{ fontSize: '11px' }}>{profileHandle}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ── Main Page
// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Plan Status helpers ───────────────────────────────────────────────────────

const PLAN_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:    { label: "Pendente",  className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  approved:   { label: "Aprovado", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  rejected:   { label: "Rejeitado",className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  generating: { label: "Gerando",  className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  done:       { label: "Pronto",   className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  newsletter: "Newsletter",
};

// ── Plan Wizard Dialog ────────────────────────────────────────────────────────

function PlanWizardDialog({
  open,
  viewDate,
  onClose,
  onSaved,
}: {
  open: boolean;
  viewDate: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [postsPerWeek, setPostsPerWeek] = React.useState(4);
  const [categoriesText, setCategoriesText] = React.useState("Educativo, Vendas, Bastidores, Tendências");
  const [formatWeights, setFormatWeights] = React.useState({
    carousel: 50,
    instagram: 30,
    linkedin: 10,
    newsletter: 10,
  });

  type GeneratedItem = {
    scheduledDate: string;
    format: string;
    category: string;
    suggestedTitle: string;
    pauta: string;
    status: "pending" | "approved" | "rejected";
  };
  const [generatedItems, setGeneratedItems] = React.useState<GeneratedItem[]>([]);
  const [expandedItem, setExpandedItem] = React.useState<number | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const generateMutation = trpc.editorialPlan.generatePlan.useMutation({
    onSuccess: (data) => {
      setGeneratedItems(
        (data.items as GeneratedItem[]).map((item) => ({ ...item, status: "pending" as const }))
      );
      setStep(2);
    },
    onError: (e) => toast.error(e.message || "Erro ao gerar plano"),
  });

  const saveMutation = trpc.editorialPlan.savePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano salvo no calendário!");
      onSaved();
      handleClose();
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar plano"),
  });

  function handleClose() {
    setStep(1);
    setGeneratedItems([]);
    setExpandedItem(null);
    onClose();
  }

  function handleGenerate() {
    const categories = categoriesText.split(",").map((c) => c.trim()).filter(Boolean);
    if (categories.length === 0) { toast.error("Adicione pelo menos uma categoria editorial."); return; }
    const formats = Object.entries(formatWeights)
      .filter(([, w]) => w > 0)
      .map(([format, weight]) => ({ format: format as "carousel" | "instagram" | "linkedin" | "newsletter", weight }));
    generateMutation.mutate({ year, month, postsPerWeek, formats, categories });
  }

  function handleSave() {
    const itemsToSave = generatedItems
      .filter((i) => i.status !== "rejected")
      .map((i) => ({
        scheduledDate: i.scheduledDate,
        format: i.format as "carousel" | "instagram" | "linkedin" | "newsletter",
        category: i.category,
        suggestedTitle: i.suggestedTitle,
        pauta: i.pauta,
        status: i.status,
      }));
    if (itemsToSave.length === 0) { toast.error("Aprove pelo menos um item antes de salvar."); return; }
    saveMutation.mutate({ year, month, items: itemsToSave });
  }

  function toggleItemStatus(idx: number, status: "approved" | "rejected") {
    setGeneratedItems((prev) =>
      prev.map((item, i) => i === idx ? { ...item, status: item.status === status ? "pending" : status } : item)
    );
  }

  function approveAll() {
    setGeneratedItems((prev) => prev.map((item) => ({ ...item, status: "approved" as const })));
  }

  const approvedCount = generatedItems.filter((i) => i.status === "approved").length;
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const formatConfig: Record<string, { icon: React.ReactNode; color: string; bar: string }> = {
    carousel:   { icon: <GalleryHorizontal className="h-4 w-4" />, color: "text-violet-600 dark:text-violet-400", bar: "bg-violet-500" },
    instagram:  { icon: <InstagramIcon className="h-4 w-4" />,     color: "text-pink-600 dark:text-pink-400",   bar: "bg-pink-500"   },
    linkedin:   { icon: <LinkedinIcon className="h-4 w-4" />,      color: "text-blue-600 dark:text-blue-400",   bar: "bg-blue-500"   },
    newsletter: { icon: <MailIcon className="h-4 w-4" />,          color: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500"  },
  };

  const totalWeight = Object.values(formatWeights).reduce((a, b) => a + b, 0);

  function adjustWeight(fmt: keyof typeof formatWeights, delta: number) {
    setFormatWeights((prev) => ({
      ...prev,
      [fmt]: Math.max(0, Math.min(100, prev[fmt] + delta)),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] flex flex-col overflow-hidden p-0">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold leading-tight">
                  {t("planWizardTitle")}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()} — {t("planWizardSubtitle")}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-0 mt-5">
            {([{ n: 1, label: t("planStep1") }, { n: 2, label: t("planStep2") }] as const).map(({ n, label }, i) => (
              <React.Fragment key={n}>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
                    step === n ? "bg-primary text-primary-foreground" :
                    step > n   ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {n}
                  </div>
                  <span className={cn("text-xs font-medium", step === n ? "text-foreground" : "text-muted-foreground")}>
                    {label}
                  </span>
                </div>
                {i === 0 && (
                  <div className="flex-1 mx-3 h-px bg-border relative">
                    <div className={cn("absolute inset-y-0 left-0 bg-primary transition-all duration-300", step === 2 ? "w-full" : "w-0")} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">

            {/* Posts per week */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{t("planPostsPerWeek")}</p>
                <span className="text-xs text-muted-foreground">posts/semana</span>
              </div>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPostsPerWeek(n)}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all",
                      postsPerWeek === n
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {postsPerWeek <= 3 ? "Cadência leve — ideal para começar ou nichos de longa duração" :
                 postsPerWeek <= 5 ? "Cadência equilibrada — ótima para crescimento consistente" :
                 "Cadência intensa — máximo alcance, exige produção acelerada"}
              </p>
            </div>

            {/* Format mix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{t("planFormatMix")}</p>
                <span className={cn("text-xs font-medium", totalWeight === 100 ? "text-green-600" : totalWeight > 100 ? "text-red-500" : "text-muted-foreground")}>
                  {totalWeight}% total
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["carousel", "instagram", "linkedin", "newsletter"] as const).map((fmt) => {
                  const cfg = formatConfig[fmt];
                  return (
                    <div key={fmt} className={cn(
                      "rounded-xl border p-3.5 space-y-3 transition-colors",
                      formatWeights[fmt] > 0 ? "border-border bg-card" : "border-dashed border-border/50 bg-muted/20 opacity-60"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cfg.color}>{cfg.icon}</span>
                          <span className="text-xs font-medium text-foreground">{FORMAT_LABELS[fmt]}</span>
                        </div>
                        <span className={cn("text-sm font-bold", formatWeights[fmt] > 0 ? cfg.color : "text-muted-foreground")}>
                          {formatWeights[fmt]}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-200", cfg.bar)}
                          style={{ width: `${formatWeights[fmt]}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => adjustWeight(fmt, -10)}
                          disabled={formatWeights[fmt] === 0}
                          className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                        >−</button>
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", cfg.bar, "opacity-40")} style={{ width: `${formatWeights[fmt]}%` }} />
                        </div>
                        <button
                          onClick={() => adjustWeight(fmt, 10)}
                          disabled={formatWeights[fmt] === 100}
                          className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Editorial categories */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t("planCategories")}</p>
              <Textarea
                placeholder={t("planCategoriesPlaceholder")}
                value={categoriesText}
                onChange={(e) => setCategoriesText(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
              <p className="text-[11px] text-muted-foreground">{t("planCategoriesHint")}</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose}>{t("cancel")}</Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2 min-w-[140px]">
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("planGenerating")}</>
                ) : (
                  <><Sparkles className="h-4 w-4" />{t("planGenerateBtn")}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 pt-1 flex-1 min-h-0">
            {/* Summary */}
            <div className="flex items-center justify-between shrink-0">
              <p className="text-xs text-muted-foreground">
                {generatedItems.length} pautas · <span className="text-green-600 font-medium">{approvedCount} {t("planItemsApproved")}</span>
              </p>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-primary" onClick={approveAll}>
                <CheckCircle2 className="h-3 w-3" />
                {t("planApproveAll")}
              </Button>
            </div>

            {/* Item list */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-0">
              {generatedItems.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "border rounded-lg transition-all",
                    item.status === "approved" && "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/10",
                    item.status === "rejected" && "border-red-200 dark:border-red-800 opacity-50",
                    item.status === "pending" && "border-border",
                  )}
                >
                  <div className="flex items-start gap-2 p-3">
                    {/* Format badge */}
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 mt-0.5",
                      PLAN_FORMAT_COLORS[item.format] ?? "bg-violet-100 text-violet-700"
                    )}>
                      {FORMAT_LABELS[item.format] ?? item.format}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground leading-snug truncate">{item.suggestedTitle}</p>
                        <button
                          onClick={() => setExpandedItem(expandedItem === idx ? null : idx)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          {expandedItem === idx ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{item.scheduledDate}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">{item.category}</span>
                      </div>
                      {expandedItem === idx && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{item.pauta}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleItemStatus(idx, "approved")}
                        title={t("planApprove")}
                        className={cn(
                          "p-1 rounded transition-colors",
                          item.status === "approved"
                            ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                            : "text-muted-foreground hover:text-green-600"
                        )}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleItemStatus(idx, "rejected")}
                        title={t("planReject")}
                        className={cn(
                          "p-1 rounded transition-colors",
                          item.status === "rejected"
                            ? "text-red-600 bg-red-100 dark:bg-red-900/30"
                            : "text-muted-foreground hover:text-red-500"
                        )}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer — always visible */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50 shrink-0">
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setStep(1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
                {t("back")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || approvedCount === 0} className="gap-2">
                {saveMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("planSaving")}</>
                ) : (
                  <><CheckCircle2 className="h-3.5 w-3.5" />{t("planSaveBtn")}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Plan Item Section (in DetailPanel) ───────────────────────────────────────

function PlanItemSection({ planItems, onGenerate }: {
  planItems: PlanItem[];
  onGenerate: (type: "carousel" | "image", item: PlanItem) => void;
}) {
  const [expandedItem, setExpandedItem] = React.useState<number | null>(null);

  if (planItems.length === 0) return null;

  return (
    <div className="px-5 py-4 border-b border-border/30 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <BookOpen className="w-3 h-3" />
        Pautas Planejadas
      </p>
      {planItems.map((item) => (
        <div key={item.id} className="border border-border/50 rounded-lg overflow-hidden">
          <div className="flex items-start gap-2 p-2.5">
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 mt-0.5 border-l-2",
              PLAN_FORMAT_COLORS[item.format] ?? "border-l-violet-500 bg-violet-50 text-violet-700"
            )}>
              {FORMAT_LABELS[item.format] ?? item.format}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <p className="text-xs font-medium text-foreground leading-snug">{item.suggestedTitle}</p>
                <button
                  onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                >
                  {expandedItem === item.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                  PLAN_STATUS_CONFIG[item.status]?.className ?? "bg-zinc-100 text-zinc-600"
                )}>
                  {PLAN_STATUS_CONFIG[item.status]?.label ?? item.status}
                </span>
                <span className="text-[10px] text-muted-foreground">{item.category}</span>
              </div>
              {expandedItem === item.id && (
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{item.pauta}</p>
              )}
            </div>
          </div>
          {item.status === "approved" && !item.socialPostId && (
            <div className="border-t border-border/30 px-2.5 py-1.5 bg-muted/20 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Zap className="h-3 w-3" />Gerar:
              </span>
              <button
                onClick={() => onGenerate("carousel", item)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 px-2 py-0.5 rounded-md hover:bg-primary/8 transition-colors"
              >
                <GalleryHorizontal className="h-3 w-3" />Carrossel
              </button>
              <span className="text-muted-foreground/40 text-xs">|</span>
              <button
                onClick={() => onGenerate("image", item)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 px-2 py-0.5 rounded-md hover:bg-primary/8 transition-colors"
              >
                <ImageIcon className="h-3 w-3" />Imagem
              </button>
            </div>
          )}
          {item.socialPostId && (
            <div className="border-t border-border/30 px-2.5 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/10">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />Conteúdo gerado — ver em Postagens
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Calendar() {
  const { t } = useLanguage();
  const { plan } = usePlan();
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createHoliday, setCreateHoliday] = useState<Holiday | undefined>(undefined);
  const [createDate, setCreateDate] = useState<Date | undefined>(undefined);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [campaignDate, setCampaignDate] = useState<Date>(today);
  const [showQuoteCardDialog, setShowQuoteCardDialog] = useState(false);
  const [quoteCardDate, setQuoteCardDate] = useState<Date>(today);
  const [quoteCardPresetImage, setQuoteCardPresetImage] = useState('');
  const [showPlanWizard, setShowPlanWizard] = useState(false);
  const [, navigate] = useLocation();

  const { data: allPosts = [] } = trpc.posts.getAll.useQuery({});

  const { data: planItems = [], refetch: refetchPlan } = trpc.editorialPlan.getByMonth.useQuery(
    { year: viewDate.getFullYear(), month: viewDate.getMonth() + 1 },
    { enabled: plan === "agency" }
  );


  const holidayMap = useMemo(() => getHolidaysForYear(viewDate.getFullYear()), [viewDate]);
  const prevYearMap = useMemo(() => getHolidaysForYear(viewDate.getFullYear() - 1), [viewDate]);
  const nextYearMap = useMemo(() => getHolidaysForYear(viewDate.getFullYear() + 1), [viewDate]);

  function getHolidaysForDate(date: Date): Holiday[] {
    const key = fmt(date);
    const y = date.getFullYear();
    const map =
      y === viewDate.getFullYear()
        ? holidayMap
        : y < viewDate.getFullYear()
        ? prevYearMap
        : nextYearMap;
    return map.get(key) ?? [];
  }

  function getPostsForDate(date: Date): SocialPost[] {
    return allPosts.filter((p) => {
      const d = p.scheduledAt ? new Date(p.scheduledAt) : null;
      return d ? isSameDay(d, date) : false;
    });
  }

  function getPlanItemsForDate(date: Date): PlanItem[] {
    const key = fmt(date);
    return (planItems as PlanItem[]).filter((item) => item.scheduledDate === key);
  }

  function handleGeneratePlanContent(type: "carousel" | "image", item: PlanItem) {
    const prefill: RadarPrefill = {
      topicAngleId: 0,
      topic: item.suggestedTitle,
      hook: item.pauta,
      hookType: "curiosidade",
    };
    sessionStorage.setItem(RADAR_PREFILL_KEY, JSON.stringify(prefill));
    navigate(type === "carousel" ? "/dashboard/carousel" : "/dashboard/images");
  }

  const calendarDays = useMemo(() => buildCalendarGrid(viewDate), [viewDate]);
  const currentMonth = viewDate.getMonth();

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDate(null);
  }
  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedDate(null);
  }
  function goToToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  function openCreatePost(holiday?: Holiday, date?: Date) {
    setCreateHoliday(holiday);
    setCreateDate(date ?? selectedDate ?? today);
    if (holiday?.id === 'theme-religiao') {
      setQuoteCardDate(date ?? selectedDate ?? today);
      setShowQuoteCardDialog(true);
    } else {
      setShowCreateDialog(true);
    }
  }

  const selectedHolidays = selectedDate ? getHolidaysForDate(selectedDate) : [];
  const selectedPosts = selectedDate ? getPostsForDate(selectedDate) : [];
  const selectedPlanItems = selectedDate ? getPlanItemsForDate(selectedDate) : [];

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const monthPostsCount = allPosts.filter((p) => {
    const d = p.scheduledAt ? new Date(p.scheduledAt) : null;
    return d ? d >= monthStart && d <= monthEnd : false;
  }).length;

  let monthHolidayCount = 0;
  for (const day of calendarDays) {
    if (day.getMonth() === currentMonth) {
      monthHolidayCount += getHolidaysForDate(day).length;
    }
  }

  return (
    <AppLayout activeModule="calendar">
      <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-4">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t("calendarTitle")}</h1>
              <p className="text-xs text-muted-foreground">
                {monthPostsCount} postagem{monthPostsCount !== 1 ? "s" : ""} agendada{monthPostsCount !== 1 ? "s" : ""} · {monthHolidayCount} data{monthHolidayCount !== 1 ? "s" : ""} relevante{monthHolidayCount !== 1 ? "s" : ""} neste mês
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {plan === "agency" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 font-medium border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
                onClick={() => setShowPlanWizard(true)}
              >
                <LayoutGrid className="w-4 h-4" />
                {t("planMonthBtn")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-2 font-medium border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => { setCampaignDate(selectedDate ?? today); setShowCampaignDialog(true); }}
            >
              <Wand2 className="w-4 h-4" />
              Campanha completa
            </Button>
            <Button
              size="sm"
              className="gap-2 font-medium"
              onClick={() => openCreatePost(undefined, today)}
            >
              <Plus className="w-4 h-4" />
              Novo post
            </Button>
          </div>
        </div>

        {/* Month navigation bar */}
        <div className="glass-card rounded-2xl px-4 py-3 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-tight">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </h2>
            <button
              onClick={goToToday}
              className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            >
              Hoje
            </button>
          </div>

          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="glass-card rounded-2xl px-4 py-3">
          <Legend />
        </div>

        {/* Calendar + detail panel */}
        <div
          className={cn(
            "grid gap-4 items-start",
            selectedDate
              ? "grid-cols-1 lg:grid-cols-[1fr_320px]"
              : "grid-cols-1"
          )}
        >
          {/* Calendar grid */}
          <div className="glass-card rounded-2xl overflow-hidden">
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-border/40">
              {WEEK_DAYS_SHORT.map((d, i) => (
                <div
                  key={d}
                  className="py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-widest hidden sm:block"
                >
                  {WEEK_DAYS[i]}
                </div>
              ))}
              {WEEK_DAYS_SHORT.map((d) => (
                <div
                  key={`s-${d}`}
                  className="py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider sm:hidden"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-border/30">
              {calendarDays.map((date, i) => {
                const inMonth = date.getMonth() === currentMonth;
                const holidays = getHolidaysForDate(date);
                const posts = getPostsForDate(date);
                const datePlanItems = getPlanItemsForDate(date);
                const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

                return (
                  <DayCell
                    key={i}
                    date={date}
                    isCurrentMonth={inMonth}
                    holidays={holidays}
                    posts={posts}
                    planItems={datePlanItems}
                    isSelected={isSelected}
                    onClick={() =>
                      setSelectedDate((prev) =>
                        prev && isSameDay(prev, date) ? null : date
                      )
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          {selectedDate && (
            <div className="glass-card rounded-2xl overflow-hidden sticky top-4">
              <DetailPanel
                date={selectedDate}
                holidays={selectedHolidays}
                posts={selectedPosts}
                onClose={() => setSelectedDate(null)}
                onCreatePost={(h) => openCreatePost(h, selectedDate)}
              />
              {selectedPlanItems.length > 0 && (
                <PlanItemSection
                  planItems={selectedPlanItems}
                  onGenerate={handleGeneratePlanContent}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create post dialog — key forces full reset when holiday/date changes */}
      <CreatePostDialog
        key={`${createHoliday?.id ?? "free"}-${createDate?.toDateString() ?? "nodate"}-${quoteCardPresetImage ? 'qc' : ''}`}
        open={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); setQuoteCardPresetImage(''); }}
        holiday={createHoliday}
        prefillDate={createDate}
        initialImageDataUrl={quoteCardPresetImage || undefined}
      />

      <QuoteCardDialog
        open={showQuoteCardDialog}
        date={quoteCardDate}
        onClose={() => setShowQuoteCardDialog(false)}
        onUseImage={(dataUrl) => {
          setQuoteCardPresetImage(dataUrl);
          setShowQuoteCardDialog(false);
          setShowCreateDialog(true);
        }}
      />

      <CampaignDialog
        open={showCampaignDialog}
        date={campaignDate}
        onClose={() => setShowCampaignDialog(false)}
      />

      <PlanWizardDialog
        open={showPlanWizard}
        viewDate={viewDate}
        onClose={() => setShowPlanWizard(false)}
        onSaved={() => { void refetchPlan(); }}
      />
    </AppLayout>
  );
}
