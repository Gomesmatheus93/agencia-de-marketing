import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import {
  type Holiday,
  type HolidayType,
  getHolidaysForYear,
  HOLIDAY_TYPE_LABELS,
  HOLIDAY_TYPE_COLORS,
} from "@/lib/holidays";
import type { SocialPost } from "@shared/types";
import { toSchedulerDatetimeLocalValue } from "@/lib/scheduling";

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

function DayCell({
  date,
  isCurrentMonth,
  holidays,
  posts,
  isSelected,
  onClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  holidays: Holiday[];
  posts: SocialPost[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const today = isToday(date);
  const maxHolidays = 2;
  const maxPosts = 2;
  const extra = Math.max(0, holidays.length - maxHolidays) + Math.max(0, posts.length - maxPosts);

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

      {extra > 0 && (
        <span className="text-[10px] text-muted-foreground pl-1">
          +{extra} mais
        </span>
      )}
    </button>
  );
}

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
      ? "square social media post, portrait format"
      : channel === "linkedin"
      ? "professional LinkedIn banner, wide format"
      : "email newsletter header, wide format";
  return `Professional marketing image celebrating ${holidayName}. ${holidayDescription}. ${format}. Modern clean design, no text overlays, high quality, vibrant yet elegant.`;
}

// ── Create Post Dialog ────────────────────────────────────────────────────────

function CreatePostDialog({
  open,
  onClose,
  holiday,
  prefillDate,
}: {
  open: boolean;
  onClose: () => void;
  holiday?: Holiday;
  prefillDate?: Date;
}) {
  const utils = trpc.useUtils();
  const [channel, setChannel] = useState<Channel>("instagram");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const base = prefillDate ?? new Date();
    const d = new Date(base);
    d.setHours(12, 0, 0, 0);
    return toSchedulerDatetimeLocalValue(d);
  });

  const generateImageMutation = trpc.images.generate.useMutation({
    onSuccess: (data) => {
      setImageUrl(data.imageUrl ?? "");
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

  const createMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      toast.success("Post criado com sucesso.");
      utils.posts.getAll.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleGenerateImage() {
    const prompt = holiday
      ? buildImagePrompt(holiday.name, holiday.description, channel)
      : `Professional marketing social media image, modern clean design, no text overlays, ${channel} format.`;
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
                <img
                  src={imageUrl}
                  alt="Imagem gerada para o post"
                  className={cn(
                    "w-full object-cover",
                    channel === "instagram" ? "aspect-[4/5]" : "aspect-video"
                  )}
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

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSubmit}
              disabled={createMutation.isPending || !content.trim() || !imageUrl}
            >
              {createMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {scheduledAt ? "Agendar post" : "Salvar rascunho"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Calendar() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createHoliday, setCreateHoliday] = useState<Holiday | undefined>(undefined);
  const [createDate, setCreateDate] = useState<Date | undefined>(undefined);

  const { data: allPosts = [] } = trpc.posts.getAll.useQuery({});

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
    setShowCreateDialog(true);
  }

  const selectedHolidays = selectedDate ? getHolidaysForDate(selectedDate) : [];
  const selectedPosts = selectedDate ? getPostsForDate(selectedDate) : [];

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
              <h1 className="text-xl font-bold text-foreground">Calendário Editorial</h1>
              <p className="text-xs text-muted-foreground">
                {monthPostsCount} postagem{monthPostsCount !== 1 ? "s" : ""} agendada{monthPostsCount !== 1 ? "s" : ""} · {monthHolidayCount} data{monthHolidayCount !== 1 ? "s" : ""} relevante{monthHolidayCount !== 1 ? "s" : ""} neste mês
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="self-start sm:self-auto gap-2 font-medium"
            onClick={() => openCreatePost(undefined, today)}
          >
            <Plus className="w-4 h-4" />
            Novo post
          </Button>
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
                const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

                return (
                  <DayCell
                    key={i}
                    date={date}
                    isCurrentMonth={inMonth}
                    holidays={holidays}
                    posts={posts}
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
            </div>
          )}
        </div>
      </div>

      {/* Create post dialog — key forces full reset when holiday/date changes */}
      <CreatePostDialog
        key={`${createHoliday?.id ?? "free"}-${createDate?.toDateString() ?? "nodate"}`}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        holiday={createHoliday}
        prefillDate={createDate}
      />
    </AppLayout>
  );
}
