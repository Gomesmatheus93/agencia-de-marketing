import React, { useState, useRef, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  Save,
  CheckCircle2,
  Pencil,
  ImageIcon,
  Wand2,
  ArrowLeft,
  Copy,
  Loader2,
  Link2,
  AlignLeft,
  AlignCenter,
  Trash2,
  Calendar,
  Download,
  Plus,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isSchedulerDatetimeLocalInFuture,
  POST_SCHEDULER_TIME_ZONE,
  toSchedulerDatetimeLocalValue,
} from "@/lib/scheduling";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Phase = "list" | "form" | "fetching" | "generating" | "preview";
type InputMode = "topic" | "url";

type WordStyle = {
  word: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
};

type ProtoSlide = {
  title: string;
  body?: string;
  imageUrl?: string;
  renderedImageUrl?: string;
  slideType?: "hook" | "development" | "cta";
  shortText?: string;
  imagePrompt?: string;
  highlightWords?: string[];
  wordStyles?: WordStyle[];
  canvaDesignId?: string;
  titleColor?: string;
  bodyColor?: string;
};

type ProtoResult = {
  id: number;
  topic: string;
  slides: ProtoSlide[];
  caption: string;
  hook: string;
  finalCta: string;
};

type ProtoListItem = {
  id: number;
  topic: string;
  style: string;
  hook: string;
  caption: string;
  finalCta: string;
  coverImageUrl: string | null;
  slides: ProtoSlide[];
  designSettings?: Partial<DesignSettings>;
  createdAt: Date | string;
};

type DesignSettings = {
  accentColor: string;
  bgColor: string;
  fontFamily: string;
  titleAlign: "left" | "center";
  titleSize: number;
  profileImageUrl?: string;
  profileName?: string;
  profileHandle?: string;
  // Cover (capa) overrides — applied only to the first/hook slide
  coverBgColor?: string;
  coverAccentColor?: string;
  coverTitleAlign?: "left" | "center";
  // Visual template
  template?: "dark" | "editorial";
};

type NamedDesignPreset = DesignSettings & { presetName: string };

type IgStyleAnalysis = {
  accentColor: string;
  bgColor: string;
  fontFamily: string;
  titleAlign: "left" | "center";
  titleSize: number;
  profileName: string;
  profileHandle: string;
  profileImageUrl?: string;
  styleSummary: string;
  toneDescription: string;
  niche?: string;
  targetAudience?: string;
  objective?: string;
  coverSlideStyle?: { bgColor: string; accentColor: string; titleAlign: "left" | "center"; description: string };
  contentSlideStyle?: { bgColor: string; accentColor: string; titleAlign: "left" | "center"; description: string };
  ctaSlideStyle?: { bgColor: string; accentColor: string; description: string };
};

const DEFAULT_DESIGN: DesignSettings = {
  accentColor: "#29d9ff",
  bgColor: "#0d1117",
  fontFamily: "system-ui, -apple-system, sans-serif",
  titleAlign: "left",
  titleSize: 1,
};

const DESIGN_STORAGE_KEY = "proto_default_design";

function loadSavedDesign(): DesignSettings {
  try {
    const raw = localStorage.getItem(DESIGN_STORAGE_KEY);
    if (!raw) return DEFAULT_DESIGN;
    const parsed = JSON.parse(raw) as Partial<DesignSettings>;
    return { ...DEFAULT_DESIGN, ...parsed };
  } catch {
    return DEFAULT_DESIGN;
  }
}

function saveDesignAsDefault(design: DesignSettings) {
  try {
    localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(design));
  } catch {
    // ignore storage errors
  }
}

const NAMED_PRESETS_KEY = "proto_named_presets";

const BUILTIN_PRESETS: NamedDesignPreset[] = [
  {
    presetName: "Perfil Flávio",
    accentColor: "#c9a227",
    bgColor: "#0f172a",
    fontFamily: "Georgia, 'Times New Roman', serif",
    titleAlign: "left",
    titleSize: 1,
    profileName: "Flávio Vasconcelos",
    profileHandle: "@comflavio",
    profileImageUrl: undefined,
  },
];

function loadNamedPresets(): NamedDesignPreset[] {
  try {
    const raw = localStorage.getItem(NAMED_PRESETS_KEY);
    return raw ? (JSON.parse(raw) as NamedDesignPreset[]) : [];
  } catch { return []; }
}

function persistNamedPreset(preset: NamedDesignPreset) {
  const existing = loadNamedPresets().filter((p) => p.presetName !== preset.presetName);
  localStorage.setItem(NAMED_PRESETS_KEY, JSON.stringify([...existing, preset]));
}

function removeNamedPreset(name: string) {
  const existing = loadNamedPresets().filter((p) => p.presetName !== name);
  localStorage.setItem(NAMED_PRESETS_KEY, JSON.stringify(existing));
}

// ─── Design presets ─────────────────────────────────────────────────────────

const ACCENT_PRESETS = [
  { label: "Ciano", color: "#29d9ff" },
  { label: "Roxo", color: "#a855f7" },
  { label: "Âmbar", color: "#f59e0b" },
  { label: "Verde", color: "#10b981" },
  { label: "Rosa", color: "#ec4899" },
  { label: "Laranja", color: "#f97316" },
];

const BG_PRESETS = [
  { label: "Preto", color: "#0d1117" },
  { label: "Navy", color: "#0f172a" },
  { label: "Violeta", color: "#1e1b4b" },
  { label: "Carvão", color: "#1c1917" },
];

const FONT_OPTIONS = [
  { label: "Moderna", value: "system-ui, -apple-system, sans-serif" },
  { label: "Serifada", value: "Georgia, 'Times New Roman', serif" },
  { label: "Bold", value: "Impact, 'Arial Black', sans-serif" },
  { label: "Mono", value: "'Courier New', Courier, monospace" },
  { label: "Fina", value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
];

// ─── renderHighlighted ────────────────────────────────────────────────────────

function renderHighlighted(
  text: string,
  words: string[],
  accentColor: string,
  wordStyles?: WordStyle[]
): React.ReactNode {
  const allStyled: Array<{ word: string; color: string; bold?: boolean; italic?: boolean }> = [
    ...words.map((w) => ({ word: w, color: accentColor })),
    ...(wordStyles ?? []).map((ws) => ({ word: ws.word, color: ws.color ?? accentColor, bold: ws.bold, italic: ws.italic })),
  ];
  if (!allStyled.length || !text) return text;
  const escaped = allStyled.map((s) => s.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const s = allStyled.find((s) => s.word.toLowerCase() === part.toLowerCase());
    if (!s) return part;
    return (
      <span key={i} style={{ color: s.color, fontWeight: s.bold ? 900 : undefined, fontStyle: s.italic ? "italic" : undefined }}>
        {part}
      </span>
    );
  });
}

// ─── EditableText ─────────────────────────────────────────────────────────────

function EditableText({
  value,
  onCommit,
  tag: Tag = "div",
  className,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  tag?: "h1" | "h2" | "p" | "div";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      style={{ ...style, outline: "none", cursor: "text", whiteSpace: "pre-wrap" }}
      className={className}
      onInput={(e: React.FormEvent<HTMLElement>) => {
        onCommit((e.currentTarget as HTMLElement).textContent ?? "");
      }}
    >
      {value}
    </Tag>
  );
}

// ─── ProtoSlideCard ───────────────────────────────────────────────────────────

function ProtoSlideCard({
  slide,
  index,
  total,
  design,
  editable = false,
  onUpdate,
}: {
  slide: ProtoSlide;
  index: number;
  total: number;
  design: DesignSettings;
  editable?: boolean;
  onUpdate?: (field: "title" | "body", value: string) => void;
}) {
  const isHook = slide.slideType === "hook" || index === 0;
  const isCta = slide.slideType === "cta" || index === total - 1;
  const slideNum = String(index + 1).padStart(2, "0");

  // Cover slide uses its own color overrides when provided
  const activeBg = isHook ? (design.coverBgColor ?? design.bgColor) : design.bgColor;
  const activeAccent = isHook ? (design.coverAccentColor ?? design.accentColor) : design.accentColor;
  const activeTitleAlign = isHook ? (design.coverTitleAlign ?? design.titleAlign) : design.titleAlign;

  const titleStyle: React.CSSProperties = {
    fontFamily: design.fontFamily,
    textAlign: activeTitleAlign,
    fontSize: `${(isHook ? 36 : 28) * design.titleSize}px`,
    textShadow: "0 2px 16px rgba(0,0,0,0.7)",
    lineHeight: 1.15,
    color: slide.titleColor ?? "#ffffff",
    fontWeight: 900,
  };
  const bodyStyle: React.CSSProperties = {
    fontFamily: design.fontFamily,
    textAlign: activeTitleAlign,
    fontSize: `${(isHook ? 17 : 15) * design.titleSize}px`,
    color: slide.bodyColor ?? "rgba(255,255,255,0.78)",
    textShadow: "0 1px 8px rgba(0,0,0,0.6)",
    lineHeight: 1.55,
  };
  const hw = slide.highlightWords ?? [];
  const hc = activeAccent;

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{ width: 400, height: 500, background: activeBg, flexShrink: 0 }}
    >
      {/* Background image */}
      {slide.imageUrl && !isCta && (
        <img
          src={resolveImgUrl(slide.imageUrl)}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}

      {/* Overlay */}
      {isCta ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 70% 110%, ${activeAccent}18 0%, transparent 60%), linear-gradient(135deg, ${activeBg} 0%, ${activeBg}ee 100%)`,
            }}
          />
          <div
            className="absolute bottom-[-100px] right-[-100px] rounded-full opacity-[0.06]"
            style={{ width: 380, height: 380, background: activeAccent }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: isHook
              ? "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0.88) 100%)"
              : "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.88) 100%)",
          }}
        />
      )}

      {/* Top accent stripe — always visible */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: 3, background: `linear-gradient(90deg, ${activeAccent}, ${activeAccent}88)` }}
      />

      {/* HOOK */}
      {isHook && (
        <div
          className="absolute inset-0 flex flex-col justify-end pb-10"
          style={{ padding: "0 32px 40px" }}
        >
          {/* Profile badge above title */}
          {design.profileImageUrl && (
            <div className="flex items-center gap-2 mb-4">
              <img
                src={design.profileImageUrl.startsWith("data:") ? design.profileImageUrl : resolveImgUrl(design.profileImageUrl)}
                className="rounded-full object-cover flex-shrink-0"
                style={{ width: 32, height: 32, border: `1.5px solid ${activeAccent}` }}
                draggable={false}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  {design.profileName && (
                    <span className="text-white font-bold leading-tight" style={{ fontSize: 11 }}>{design.profileName}</span>
                  )}
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="6.5" cy="6.5" r="6.5" fill="#1d9bf0"/>
                    <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {design.profileHandle && (
                  <span className="leading-tight" style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", display: "block" }}>{design.profileHandle}</span>
                )}
              </div>
            </div>
          )}
          <div
            className="mb-3 rounded-full"
            style={{ width: 44, height: 3, background: activeAccent }}
          />
          <h1 style={titleStyle} className="mb-3">{renderHighlighted(slide.title, hw, hc, slide.wordStyles)}</h1>
          {editable ? (
            <EditableText value={slide.body ?? ""} onCommit={(v) => onUpdate?.("body", v)} tag="p" style={bodyStyle} />
          ) : (
            slide.body && <p style={bodyStyle}>{renderHighlighted(slide.body, hw, hc, slide.wordStyles)}</p>
          )}
          <p
            className="mt-5 font-medium tracking-widest uppercase pointer-events-none"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: design.fontFamily }}
          >
            Deslize para continuar →
          </p>
        </div>
      )}

      {/* CONTENT */}
      {!isHook && !isCta && (
        <div
          className="absolute inset-0 flex flex-col justify-end pb-10"
          style={{ padding: "0 32px 40px" }}
        >
          <div
            className="absolute top-6 left-8 font-black leading-none select-none"
            style={{ fontSize: 80, color: design.accentColor, opacity: 0.12, fontFamily: design.fontFamily }}
          >
            {slideNum}
          </div>
          {/* Profile badge above title */}
          {design.profileImageUrl && (
            <div className="flex items-center gap-2 mb-3">
              <img
                src={design.profileImageUrl.startsWith("data:") ? design.profileImageUrl : resolveImgUrl(design.profileImageUrl)}
                className="rounded-full object-cover flex-shrink-0"
                style={{ width: 26, height: 26, border: `1.5px solid ${design.accentColor}` }}
                draggable={false}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  {design.profileName && (
                    <span className="text-white font-bold leading-tight" style={{ fontSize: 10 }}>{design.profileName}</span>
                  )}
                  <svg width="11" height="11" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="6.5" cy="6.5" r="6.5" fill="#1d9bf0"/>
                    <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {design.profileHandle && (
                  <span className="leading-tight" style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", display: "block" }}>{design.profileHandle}</span>
                )}
              </div>
            </div>
          )}
          <div
            className="mb-3 rounded-full"
            style={{ width: 32, height: 3, background: design.accentColor }}
          />
          <h2 style={{ ...titleStyle, fontSize: `${28 * design.titleSize}px` }} className="mb-3">{renderHighlighted(slide.title, hw, hc, slide.wordStyles)}</h2>
          {editable ? (
            <EditableText value={slide.body ?? ""} onCommit={(v) => onUpdate?.("body", v)} tag="p" style={bodyStyle} />
          ) : (
            slide.body && <p style={bodyStyle}>{renderHighlighted(slide.body, hw, hc, slide.wordStyles)}</p>
          )}
        </div>
      )}

      {/* CTA */}
      {isCta && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: "0 32px" }}>
          {/* Bottom glow */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{ height: 220, background: `radial-gradient(ellipse at 50% 120%, ${design.accentColor}30 0%, transparent 70%)` }}
          />

          {/* Profile badge (CTA) */}
          {design.profileImageUrl && (
            <div className="flex items-center gap-2 mb-5">
              <img
                src={design.profileImageUrl.startsWith("data:") ? design.profileImageUrl : resolveImgUrl(design.profileImageUrl)}
                className="rounded-full object-cover flex-shrink-0"
                style={{ width: 30, height: 30, border: `1.5px solid ${design.accentColor}` }}
                draggable={false}
              />
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1">
                  {design.profileName && (
                    <span className="text-white font-bold leading-tight" style={{ fontSize: 11 }}>{design.profileName}</span>
                  )}
                  <svg width="12" height="12" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="6.5" cy="6.5" r="6.5" fill="#1d9bf0"/>
                    <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {design.profileHandle && (
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", display: "block" }}>{design.profileHandle}</span>
                )}
              </div>
            </div>
          )}

          {/* Decorative top mark — only when no profile */}
          {!design.profileImageUrl && (
            <div className="flex flex-col items-center mb-6">
              <div className="rounded-full mb-2" style={{ width: 3, height: 24, background: `${design.accentColor}55` }} />
              <div className="rounded-full" style={{ width: 48, height: 3, background: design.accentColor }} />
            </div>
          )}

          {/* Title */}
          <h1 style={{ ...titleStyle, fontSize: `${30 * design.titleSize}px`, textAlign: "center", lineHeight: 1.1 }} className="mb-4">{renderHighlighted(slide.title, hw, hc, slide.wordStyles)}</h1>

          {/* Body */}
          {editable ? (
            <EditableText value={slide.body ?? ""} onCommit={(v) => onUpdate?.("body", v)} tag="p" style={{ ...bodyStyle, fontSize: `${14 * design.titleSize}px`, textAlign: "center", lineHeight: 1.6 }} className="mb-7" />
          ) : (
            slide.body && (
              <p style={{ ...bodyStyle, fontSize: `${14 * design.titleSize}px`, textAlign: "center", lineHeight: 1.6 }} className="mb-7">
                {renderHighlighted(slide.body, hw, hc, slide.wordStyles)}
              </p>
            )
          )}

          {/* Primary CTA — specific action from the AI */}
          {slide.shortText && (
            <div
              className="rounded-full px-7 py-3 font-bold tracking-wide mb-5"
              style={{ background: design.accentColor, color: design.bgColor, fontSize: 13, fontFamily: design.fontFamily }}
            >
              {slide.shortText}
            </div>
          )}

          {/* Separator */}
          <div className="flex items-center gap-3 w-full mb-4" style={{ opacity: 0.2 }}>
            <div className="flex-1 h-px" style={{ background: "white" }} />
            <div className="w-1 h-1 rounded-full" style={{ background: "white" }} />
            <div className="flex-1 h-px" style={{ background: "white" }} />
          </div>

          {/* Engagement row — subtle secondary */}
          <div className="flex items-center gap-4">
            {[
              { icon: "♥", label: "Curtir" },
              { icon: "💬", label: "Comentar" },
              { icon: "↗", label: "Compartilhar" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span style={{ fontSize: 14, opacity: 0.5 }}>{icon}</span>
                <span
                  className="font-semibold tracking-widest uppercase"
                  style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", fontFamily: design.fontFamily }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counter */}
      <div
        className="absolute bottom-3 right-5 font-mono"
        style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}
      >
        {index + 1}/{total}
      </div>
    </div>
  );
}

// ─── EditorialSlideCard ───────────────────────────────────────────────────────

function EditorialSlideCard({
  slide, index, total, design, editable = false, onUpdate,
}: {
  slide: ProtoSlide; index: number; total: number; design: DesignSettings;
  editable?: boolean; onUpdate?: (field: "title" | "body", value: string) => void;
}) {
  const isHook = slide.slideType === "hook" || index === 0;
  const isCta = slide.slideType === "cta" || index === total - 1;
  const contentIndex = index - 1;
  const isTypeA = !isHook && !isCta && contentIndex % 2 === 0;

  const accent = isHook ? (design.coverAccentColor ?? design.accentColor) : design.accentColor;
  const hw = slide.highlightWords ?? [];
  const handle = design.profileHandle || "@handle";
  const brand = design.profileName || "Content Machine";
  const year = new Date().getFullYear();
  const ff = design.fontFamily;

  // ── COVER ────────────────────────────────────────────────────────────────────
  if (isHook) {
    return (
      <div className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ width: 400, height: 500, background: design.coverBgColor ?? "#111111", flexShrink: 0 }}>
        {slide.imageUrl && (
          <img src={resolveImgUrl(slide.imageUrl)}
            className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        )}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.48) 42%, rgba(0,0,0,0.86) 100%)" }} />

        {/* Top bar */}
        <div className="absolute top-3.5 left-4 right-4 flex justify-between items-center">
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", fontFamily: ff, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" as const }}>
            {brand}
          </span>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", fontFamily: ff, letterSpacing: 0.4 }}>{handle}</span>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-10 left-5 right-5">
          <div className="flex items-center gap-1.5 mb-3">
            {design.profileImageUrl ? (
              <img
                src={design.profileImageUrl.startsWith("data:") ? design.profileImageUrl : resolveImgUrl(design.profileImageUrl)}
                className="rounded-full object-cover flex-shrink-0"
                style={{ width: 22, height: 22, border: `1.5px solid ${accent}` }}
                draggable={false}
              />
            ) : (
              <div className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 16, height: 16, background: accent }}>
                <span style={{ color: "white", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>+</span>
              </div>
            )}
            <span style={{ fontSize: 11, color: "white", fontFamily: ff, fontWeight: 700 }}>{handle}</span>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="6.5" cy="6.5" r="6.5" fill="#1d9bf0" />
              <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 31 * design.titleSize, fontWeight: 900, color: slide.titleColor ?? "white", lineHeight: 1.1, textTransform: "uppercase" as const, fontFamily: ff }} className="mb-2">
            {renderHighlighted(slide.title, hw, accent, slide.wordStyles)}
          </h1>
          {slide.body && (
            editable ? (
              <EditableText value={slide.body} onCommit={(v) => onUpdate?.("body", v)} tag="p"
                style={{ fontSize: 10, color: slide.bodyColor ?? "rgba(255,255,255,0.62)", fontFamily: ff, fontWeight: 500, letterSpacing: 0.3 }} />
            ) : (
              <p style={{ fontSize: 10, color: slide.bodyColor ?? "rgba(255,255,255,0.62)", fontFamily: ff, fontWeight: 500, letterSpacing: 0.3 }}>
                → {slide.body}
              </p>
            )
          )}
        </div>

        {/* Slide counter */}
        <div className="absolute bottom-3 right-4"
          style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: ff }}>{index + 1}/{total}</div>
        {/* Progress dots */}
        <div className="absolute bottom-3.5 left-0 right-0 flex justify-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ width: i === index ? 14 : 5, height: 2, borderRadius: 1, background: i === index ? "white" : "rgba(255,255,255,0.3)", transition: "width 0.2s" }} />
          ))}
        </div>
      </div>
    );
  }

  // ── CTA ──────────────────────────────────────────────────────────────────────
  if (isCta) {
    return (
      <div className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ width: 400, height: 500, background: "#ffffff", flexShrink: 0, fontFamily: ff }}>
        <div className="flex justify-between items-center px-4 pt-3 pb-0">
          <span style={{ fontSize: 8, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>Powered by {brand}</span>
          <span style={{ fontSize: 8, color: "rgba(0,0,0,0.28)" }}>{handle}</span>
          <span style={{ fontSize: 8, color: "rgba(0,0,0,0.42)", fontWeight: 700 }}>{year} //</span>
        </div>
        <div className="absolute inset-x-4 h-px bg-black/8" style={{ top: 34 }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          <div style={{ width: 48, height: 3, background: accent, borderRadius: 2, marginBottom: 18 }} />
          <h1 style={{ fontSize: 24 * design.titleSize, fontWeight: 900, color: slide.titleColor ?? "#000", textAlign: "center", lineHeight: 1.15, marginBottom: 12 }}>
            {renderHighlighted(slide.title, hw, accent, slide.wordStyles)}
          </h1>
          {slide.body && (
            <p style={{ fontSize: 12, color: slide.bodyColor ?? "#555", textAlign: "center", lineHeight: 1.55, marginBottom: 20 }}>{slide.body}</p>
          )}
          {slide.shortText && (
            <div className="rounded-full px-6 py-2.5 font-bold" style={{ background: accent, color: "#fff", fontSize: 12 }}>
              {slide.shortText}
            </div>
          )}
          {design.profileImageUrl && (
            <div className="flex items-center gap-2 mt-5">
              <img
                src={design.profileImageUrl.startsWith("data:") ? design.profileImageUrl : resolveImgUrl(design.profileImageUrl)}
                className="rounded-full object-cover"
                style={{ width: 28, height: 28, border: `2px solid ${accent}` }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#000" }}>{handle}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CONTENT SLIDES — alternating white / dark ────────────────────────────────
  const isDark = !isTypeA;
  const contentBg = isDark ? "#111111" : "#ffffff";
  const cTitleColor = slide.titleColor ?? (isDark ? "#ffffff" : "#000000");
  const cBodyColor = slide.bodyColor ?? (isDark ? "rgba(255,255,255,0.68)" : "#333333");
  const hdrFg = isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.28)";
  const hdrFgBold = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.42)";
  const dividerFg = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const imgPlaceholderBg = isDark ? "#222222" : "#f0f0f0";

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{ width: 400, height: 500, background: contentBg, flexShrink: 0, fontFamily: ff }}>
      {/* Header row */}
      <div className="flex justify-between items-center px-4 pt-3 pb-0" style={{ height: 36 }}>
        <span style={{ fontSize: 8, color: hdrFg, fontWeight: 500 }}>Powered by {brand}</span>
        <span style={{ fontSize: 8, color: hdrFg }}>{handle}</span>
        <span style={{ fontSize: 8, color: hdrFgBold, fontWeight: 700 }}>{year} //</span>
      </div>
      <div className="absolute inset-x-4 h-px" style={{ top: 34, background: dividerFg }} />

      {/* Content: accent bar → title → body → image fills rest */}
      <div className="px-4 pt-3 pb-3" style={{ height: "calc(100% - 36px)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ width: 32, height: 2, background: accent, borderRadius: 2, flexShrink: 0 }} />
        <div style={{ flex: "0 0 auto" }}>
          <h2 style={{ fontSize: 20 * design.titleSize, fontWeight: 800, color: cTitleColor, lineHeight: 1.2, fontFamily: ff }}>
            {renderHighlighted(slide.title, hw, accent, slide.wordStyles)}
          </h2>
        </div>
        {slide.body && (
          <div style={{ flex: "0 0 auto" }}>
            {editable ? (
              <EditableText value={slide.body} onCommit={(v) => onUpdate?.("body", v)} tag="p"
                style={{ fontSize: 12, color: cBodyColor, lineHeight: 1.65, fontFamily: ff }} />
            ) : (
              <p style={{ fontSize: 12, color: cBodyColor, lineHeight: 1.65, fontFamily: ff }}>
                {renderHighlighted(slide.body, hw, accent, slide.wordStyles)}
              </p>
            )}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 80, borderRadius: 6, overflow: "hidden", background: imgPlaceholderBg }}>
          {slide.imageUrl
            ? <img src={resolveImgUrl(slide.imageUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
            : <div className="w-full h-full flex items-center justify-center"><span style={{ fontSize: 10, color: "#888" }}>Imagem</span></div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── SlideGridItem ────────────────────────────────────────────────────────────

function SlideGridItem({
  slide, index, total, design, active, accentColor, onClick, onUpdate,
}: {
  slide: ProtoSlide; index: number; total: number; design: DesignSettings;
  active: boolean; accentColor: string;
  onClick: () => void; onUpdate: (field: "title" | "body", value: string) => void;
}) {
  const SCALE = 0.55;
  return (
    <div
      className="relative flex-shrink-0 cursor-pointer transition-all duration-150"
      style={{
        width: 400 * SCALE, height: 500 * SCALE, borderRadius: 16, overflow: "hidden",
        boxShadow: active
          ? `0 0 0 2.5px ${accentColor}, 0 8px 32px rgba(0,0,0,0.35)`
          : "0 2px 16px rgba(0,0,0,0.18)",
        transform: active ? "translateY(-3px) scale(1.01)" : "none",
      }}
      onClick={onClick}
    >
      <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", width: 400, height: 500, pointerEvents: active ? "all" : "none" }}>
        {design.template === "editorial" ? (
          <EditorialSlideCard
            key={active ? `${index}-active` : String(index)}
            slide={slide} index={index} total={total} design={design}
            editable={active} onUpdate={onUpdate}
          />
        ) : (
          <ProtoSlideCard
            key={active ? `${index}-active` : String(index)}
            slide={slide} index={index} total={total} design={design}
            editable={active} onUpdate={onUpdate}
          />
        )}
      </div>
    </div>
  );
}

// ─── Generation steps ─────────────────────────────────────────────────────────

const GEN_STEPS = [
  "Pesquisando o tema na web...",
  "Gerando conteúdo com IA...",
  "Buscando imagens em HD...",
  "Montando os slides...",
];
const GEN_STEP_DURATIONS = [3200, 7000, 4000, 1800];

// ─── ColorSwatch ──────────────────────────────────────────────────────────────

function ColorSwatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-7 h-7 rounded-lg border-2 transition-all",
        active ? "scale-110" : "border-transparent hover:scale-105"
      )}
      style={{ background: color, borderColor: active ? "#fff" : "transparent" }}
      title={color}
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveImgUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  if (typeof window !== "undefined") return new URL(url, window.location.origin).toString();
  return url;
}

// ─── Canvas slide renderer (for Instagram export) ────────────────────────────

function _hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Renders a single line with per-word color/bold/italic overrides
function _drawStyledLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  baseSz: number,
  baseWeight: string,
  ff: string,
  baseColor: string,
  wordStyles: WordStyle[],
  tAlign: CanvasTextAlign
): void {
  if (!wordStyles.length) {
    ctx.fillStyle = baseColor;
    ctx.fillText(line, x, y);
    return;
  }
  const tokens = line.split(/(\s+)/);
  // measure total width for alignment
  let totalW = 0;
  for (const t of tokens) {
    const ws = t.trim() ? wordStyles.find((s) => s.word.toLowerCase() === t.toLowerCase()) : undefined;
    const w = ws?.bold ? "900" : baseWeight;
    const it = ws?.italic ? "italic " : "";
    ctx.font = `${it}${w} ${baseSz}px ${ff}, sans-serif`;
    totalW += ctx.measureText(t).width;
  }
  let cx = tAlign === "center" ? x - totalW / 2 : tAlign === "right" ? x - totalW : x;
  const savedAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (const t of tokens) {
    const ws = t.trim() ? wordStyles.find((s) => s.word.toLowerCase() === t.toLowerCase()) : undefined;
    const w = ws?.bold ? "900" : baseWeight;
    const it = ws?.italic ? "italic " : "";
    ctx.font = `${it}${w} ${baseSz}px ${ff}, sans-serif`;
    ctx.fillStyle = ws?.color ?? baseColor;
    ctx.fillText(t, cx, y);
    cx += ctx.measureText(t).width;
  }
  ctx.textAlign = savedAlign;
  // reset font to base
  ctx.font = `${baseWeight} ${baseSz}px ${ff}, sans-serif`;
}

function _wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

async function _loadImgCrossOrigin(url: string): Promise<HTMLImageElement> {
  // Route external URLs through the server proxy to avoid canvas CORS taint
  const isExternal = /^https?:\/\//i.test(url) &&
    (typeof window === "undefined" || !url.includes(window.location.hostname));
  const src = isExternal
    ? `/api/image-proxy?url=${encodeURIComponent(url)}`
    : url;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const t = setTimeout(() => reject(new Error("timeout")), 15_000);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); reject(new Error("load error")); };
    img.src = src;
  });
}

function _drawProfileBadge(
  ctx: CanvasRenderingContext2D,
  profileImg: HTMLImageElement | null,
  design: DesignSettings,
  S: number,
  x: number,
  y: number,
  imgSize: number,
  ff: string
) {
  const badgeGap = 8 * S;
  const nameSize = 11 * S;
  const handleSize = 9 * S;
  const lineSpacing = 4 * S;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + imgSize / 2, y + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (profileImg) {
    ctx.drawImage(profileImg, x, y, imgSize, imgSize);
  } else {
    ctx.fillStyle = design.accentColor;
    ctx.fillRect(x, y, imgSize, imgSize);
  }
  ctx.restore();

  ctx.strokeStyle = design.accentColor;
  ctx.lineWidth = 1.5 * S;
  ctx.beginPath();
  ctx.arc(x + imgSize / 2, y + imgSize / 2, imgSize / 2 - 0.5, 0, Math.PI * 2);
  ctx.stroke();

  const textX = x + imgSize + badgeGap;
  const midY = y + imgSize / 2;
  const nameY = midY - lineSpacing / 2;

  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
  ctx.font = `700 ${nameSize}px ${ff}, sans-serif`;
  ctx.fillStyle = "#ffffff";
  const nameText = design.profileName ?? "";
  ctx.fillText(nameText, textX, nameY);

  const nameWidth = ctx.measureText(nameText).width;
  const vSize = 13 * S;
  const vCX = textX + nameWidth + 4 * S + vSize / 2;
  const vCY = nameY - vSize * 0.42;

  ctx.fillStyle = "#1d9bf0";
  ctx.beginPath();
  ctx.arc(vCX, vCY, vSize / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5 * S;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(vCX - 3 * S, vCY);
  ctx.lineTo(vCX - 0.5 * S, vCY + 2.5 * S);
  ctx.lineTo(vCX + 3 * S, vCY - 2 * S);
  ctx.stroke();

  if (design.profileHandle) {
    ctx.font = `${handleSize}px ${ff}, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(design.profileHandle, textX, nameY + lineSpacing + handleSize);
  }
}

async function renderSlidesToDataUrls(
  slides: ProtoSlide[],
  design: DesignSettings
): Promise<string[]> {
  const W = 1080; // exact integer — 4:5 Instagram portrait
  const H = 1350;
  const S = W / 400; // scaling factor for coordinate calculations
  const PX = 32 * S;
  const PB = 40 * S;
  const ff = design.fontFamily.split(",")[0].trim().replace(/['"]/g, "") || "system-ui";

  // Pre-load profile image once for all slides
  let profileImg: HTMLImageElement | null = null;
  if (design.profileImageUrl) {
    try {
      const src = design.profileImageUrl.startsWith("data:")
        ? design.profileImageUrl
        : resolveImgUrl(design.profileImageUrl) ?? design.profileImageUrl;
      profileImg = await _loadImgCrossOrigin(src);
    } catch { /* no profile image */ }
  }
  const PROFILE_IMG_SIZE = 32 * S;
  const PROFILE_BADGE_H = design.profileImageUrl ? PROFILE_IMG_SIZE + 16 * S : 0;

  const results: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const isHook = slide.slideType === "hook" || i === 0;
    const isCta = slide.slideType === "cta" || i === slides.length - 1;

    // Per-slide color overrides
    const cBg = isHook ? (design.coverBgColor ?? design.bgColor) : design.bgColor;
    const cAccent = isHook ? (design.coverAccentColor ?? design.accentColor) : design.accentColor;
    const cAlign = isHook ? (design.coverTitleAlign ?? design.titleAlign) : design.titleAlign;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Background
    ctx.fillStyle = cBg;
    ctx.fillRect(0, 0, W, H);

    // Background image (non-CTA)
    if (slide.imageUrl && !isCta) {
      try {
        const imgUrl = resolveImgUrl(slide.imageUrl) ?? slide.imageUrl;
        const img = await _loadImgCrossOrigin(imgUrl);
        const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const dw = img.naturalWidth * sc;
        const dh = img.naturalHeight * sc;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } catch { /* keep solid background */ }
    }

    // Gradient overlay
    if (!isCta) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      if (isHook) {
        grad.addColorStop(0, "rgba(0,0,0,0.08)");
        grad.addColorStop(0.45, "rgba(0,0,0,0.48)");
        grad.addColorStop(1, "rgba(0,0,0,0.88)");
      } else {
        grad.addColorStop(0, "rgba(0,0,0,0.28)");
        grad.addColorStop(0.45, "rgba(0,0,0,0.55)");
        grad.addColorStop(1, "rgba(0,0,0,0.88)");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      const grd = ctx.createRadialGradient(W * 0.7, H * 1.1, 0, W * 0.7, H * 1.1, H * 0.65);
      grd.addColorStop(0, _hexToRgba(cAccent, 0.09));
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }

    // Top stripe
    ctx.fillStyle = cAccent;
    ctx.fillRect(0, 0, W, 3 * S);

    const tAlign: CanvasTextAlign = cAlign === "center" ? "center" : "left";
    const tX = tAlign === "center" ? W / 2 : PX;

    if (isHook) {
      const tsz = Math.round(36 * S * design.titleSize);
      const bsz = Math.round(17 * S * design.titleSize);
      const barH = 3 * S; const barW = 44 * S;
      const gap = 12 * S;

      ctx.font = `900 ${tsz}px ${ff}, sans-serif`;
      const tLines = _wrapCanvasText(ctx, slide.title, W - PX * 2);
      ctx.font = `${bsz}px ${ff}, sans-serif`;
      const bLines = slide.body ? _wrapCanvasText(ctx, slide.body, W - PX * 2) : [];

      const tH = tLines.length * tsz * 1.15;
      const bH = bLines.length > 0 ? bLines.length * bsz * 1.55 + gap : 0;
      const swH = 10 * S + 20 * S;
      const total = PROFILE_BADGE_H + barH + gap + tH + gap + bH + swH;
      let y = H - PB - total;

      // Profile badge above accent bar
      if (design.profileImageUrl) {
        _drawProfileBadge(ctx, profileImg, { ...design, accentColor: cAccent }, S, PX, y, PROFILE_IMG_SIZE, ff);
        y += PROFILE_BADGE_H;
      }

      ctx.fillStyle = cAccent;
      ctx.fillRect(tAlign === "center" ? (W - barW) / 2 : PX, y, barW, barH);
      y += barH + gap;

      ctx.textAlign = tAlign;
      ctx.font = `900 ${tsz}px ${ff}, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 12;
      const titleColor = slide.titleColor ?? "#ffffff";
      const ws = slide.wordStyles ?? [];
      for (const line of tLines) {
        _drawStyledLine(ctx, line, tX, y + tsz * 0.82, tsz, "900", ff, titleColor, ws, tAlign);
        y += tsz * 1.15;
      }
      ctx.shadowBlur = 0; y += gap;

      if (bLines.length) {
        ctx.font = `${bsz}px ${ff}, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 8;
        for (const line of bLines) { ctx.fillText(line, tX, y + bsz * 0.82); y += bsz * 1.55; }
        ctx.shadowBlur = 0; y += 20 * S;
      }

      ctx.font = `500 ${10 * S}px monospace`;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "left";
      ctx.fillText("DESLIZE PARA CONTINUAR →", PX, y + 10 * S * 0.82);

    } else if (!isCta) {
      const tsz = Math.round(28 * S * design.titleSize);
      const bsz = Math.round(15 * S * design.titleSize);
      const barH = 3 * S; const barW = 32 * S;
      const gap = 12 * S;
      const slideNum = String(i + 1).padStart(2, "0");

      ctx.font = `900 ${80 * S}px ${ff}, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillStyle = _hexToRgba(cAccent, 0.12);
      ctx.fillText(slideNum, PX, 80 * S * 0.82 + 24);

      ctx.font = `900 ${tsz}px ${ff}, sans-serif`;
      const tLines = _wrapCanvasText(ctx, slide.title, W - PX * 2);
      ctx.font = `${bsz}px ${ff}, sans-serif`;
      const bLines = slide.body ? _wrapCanvasText(ctx, slide.body, W - PX * 2) : [];

      const tH = tLines.length * tsz * 1.15;
      const bH = bLines.length > 0 ? bLines.length * bsz * 1.55 + gap : 0;
      const contentProfileBadgeH = design.profileImageUrl ? (26 * S + 12 * S) : 0;
      const total = contentProfileBadgeH + barH + gap + tH + gap + bH;
      let y = H - PB - total;

      // Profile badge above accent bar (slightly smaller on content slides)
      if (design.profileImageUrl) {
        _drawProfileBadge(ctx, profileImg, design, S, PX, y, 26 * S, ff);
        y += contentProfileBadgeH;
      }

      ctx.fillStyle = cAccent;
      ctx.fillRect(tAlign === "center" ? (W - barW) / 2 : PX, y, barW, barH);
      y += barH + gap;

      ctx.textAlign = tAlign;
      ctx.font = `900 ${tsz}px ${ff}, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 12;
      const cTitleColor = slide.titleColor ?? "#ffffff";
      const cWs = slide.wordStyles ?? [];
      for (const line of tLines) {
        _drawStyledLine(ctx, line, tX, y + tsz * 0.82, tsz, "900", ff, cTitleColor, cWs, tAlign);
        y += tsz * 1.15;
      }
      ctx.shadowBlur = 0; y += gap;

      if (bLines.length) {
        ctx.font = `${bsz}px ${ff}, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 8;
        for (const line of bLines) { ctx.fillText(line, tX, y + bsz * 0.82); y += bsz * 1.55; }
        ctx.shadowBlur = 0;
      }

    } else {
      // CTA
      const tsz = Math.round(30 * S * design.titleSize);
      const bsz = Math.round(14 * S * design.titleSize);
      const ctaSz = 13 * S;
      const cx = W / 2;
      ctx.textAlign = "center";

      // Decorative mark (shift up if profile badge present)
      const ctaProfileBadgeH = design.profileImageUrl ? (30 * S + 20 * S) : 0;
      const markShift = ctaProfileBadgeH / 2;
      ctx.fillStyle = _hexToRgba(cAccent, 0.33);
      ctx.fillRect(cx - 1.5 * S, H / 2 - 180 * S - markShift, 3 * S, 24 * S);
      ctx.fillStyle = cAccent;
      ctx.fillRect(cx - 24 * S, H / 2 - 150 * S - markShift, 48 * S, 3 * S);

      let y = H / 2 - 130 * S - markShift;

      // Profile badge (centered, above title)
      if (design.profileImageUrl) {
        const badgeImgSize = 30 * S;
        const badgeTextW = ((design.profileName?.length ?? 0) * 7 * S) + 20 * S;
        const badgeX = cx - (badgeImgSize + 8 * S + badgeTextW) / 2;
        _drawProfileBadge(ctx, profileImg, design, S, badgeX, y, badgeImgSize, ff);
        y += ctaProfileBadgeH;
      }

      ctx.textAlign = "center";
      ctx.font = `900 ${tsz}px ${ff}, sans-serif`;
      const ctaTLines = _wrapCanvasText(ctx, slide.title, W - PX * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 12;
      for (const line of ctaTLines) { ctx.fillText(line, cx, y + tsz * 0.82); y += tsz * 1.1; }
      ctx.shadowBlur = 0; y += bsz;

      if (slide.body) {
        ctx.font = `${bsz}px ${ff}, sans-serif`;
        const ctaBLines = _wrapCanvasText(ctx, slide.body, W - PX * 2);
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        for (const line of ctaBLines) { ctx.fillText(line, cx, y + bsz * 0.82); y += bsz * 1.6; }
        y += bsz * 0.5;
      }

      if (slide.shortText) {
        ctx.font = `700 ${ctaSz}px ${ff}, sans-serif`;
        const btnTW = ctx.measureText(slide.shortText).width;
        const bpx = 28 * S; const bpy = 14 * S;
        const btnW = btnTW + bpx * 2; const btnH = ctaSz + bpy * 2;
        ctx.fillStyle = cAccent;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - btnW / 2, y, btnW, btnH, btnH / 2);
        else ctx.rect(cx - btnW / 2, y, btnW, btnH);
        ctx.fill();
        ctx.fillStyle = cBg;
        ctx.fillText(slide.shortText, cx, y + btnH / 2 + ctaSz * 0.38);
        y += btnH + 40 * S;
      }

      // Separator
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = S;
      ctx.beginPath(); ctx.moveTo(PX, y); ctx.lineTo(cx - 8 * S, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath(); ctx.arc(cx, y, 2 * S, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 8 * S, y); ctx.lineTo(W - PX, y); ctx.stroke();
      y += 16 * S;

      const engIcons = [{ icon: "♥", label: "CURTIR" }, { icon: "💬", label: "COMENTAR" }, { icon: "↗", label: "COMPARTILHAR" }];
      engIcons.forEach(({ icon, label }, j) => {
        const ix = cx + (j - 1) * 100 * S;
        ctx.font = `${14 * S}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(icon, ix, y + 14 * S);
        ctx.font = `600 ${8 * S}px ${ff}, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillText(label, ix, y + 26 * S);
      });
    }

    // Slide counter
    ctx.textAlign = "right";
    ctx.font = `${10 * S}px monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillText(`${i + 1}/${slides.length}`, W - 20 * S, H - 12 * S);

    results.push(canvas.toDataURL("image/jpeg", 0.95));
  }

  return results;
}

// Wrapper that dispatches to the right renderer based on design.template
async function renderSlidesToDataUrlsForTemplate(
  slides: ProtoSlide[],
  design: DesignSettings
): Promise<string[]> {
  if (design.template === "editorial") return renderEditorialSlidesToDataUrls(slides, design);
  return renderSlidesToDataUrls(slides, design);
}

async function renderEditorialSlidesToDataUrls(
  slides: ProtoSlide[],
  design: DesignSettings
): Promise<string[]> {
  const W = 1080;
  const H = 1350;
  const S = W / 400;
  const PX = 16 * S;
  const ff = design.fontFamily.split(",")[0].trim().replace(/['"]/g, "") || "system-ui";
  const accent = design.accentColor;
  const coverAccent = design.coverAccentColor ?? accent;
  const handle = design.profileHandle || "@handle";
  const brand = design.profileName || "Content Machine";
  const year = new Date().getFullYear();
  const results: string[] = [];

  // Pre-load profile image
  let profileImg: HTMLImageElement | null = null;
  if (design.profileImageUrl) {
    try {
      const src = design.profileImageUrl.startsWith("data:")
        ? design.profileImageUrl
        : resolveImgUrl(design.profileImageUrl) ?? design.profileImageUrl;
      profileImg = await _loadImgCrossOrigin(src);
    } catch { /* no profile image */ }
  }

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const isHook = slide.slideType === "hook" || i === 0;
    const isCta = slide.slideType === "cta" || i === slides.length - 1;
    const contentIndex = i - 1;
    const isTypeA = !isHook && !isCta && contentIndex % 2 === 0;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (isHook) {
      // Dark background
      ctx.fillStyle = design.coverBgColor ?? "#111111";
      ctx.fillRect(0, 0, W, H);

      // Background image
      if (slide.imageUrl) {
        try {
          const img = await _loadImgCrossOrigin(resolveImgUrl(slide.imageUrl) ?? slide.imageUrl);
          const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight);
          const dw = img.naturalWidth * sc; const dh = img.naturalHeight * sc;
          ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        } catch { /* keep bg */ }
      }

      // Gradient overlay
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0.38)");
      grad.addColorStop(0.42, "rgba(0,0,0,0.48)");
      grad.addColorStop(1, "rgba(0,0,0,0.86)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Top bar
      const topY = 16 * S;
      ctx.font = `600 ${8 * S}px ${ff}, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.textAlign = "left";
      ctx.fillText(brand.toUpperCase(), PX, topY);
      ctx.textAlign = "right";
      ctx.fillText(handle, W - PX, topY);

      // Profile badge (photo or + circle)
      let y = H - 120 * S;
      const circleR = 11 * S;
      if (profileImg) {
        ctx.save(); ctx.beginPath(); ctx.arc(PX + circleR, y + circleR, circleR, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(profileImg, PX, y, circleR * 2, circleR * 2); ctx.restore();
        ctx.strokeStyle = coverAccent; ctx.lineWidth = 1.5 * S;
        ctx.beginPath(); ctx.arc(PX + circleR, y + circleR, circleR, 0, Math.PI * 2); ctx.stroke();
      } else {
        const smallR = 9 * S;
        ctx.fillStyle = coverAccent;
        ctx.beginPath(); ctx.arc(PX + smallR, y + smallR, smallR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = `900 ${11 * S}px ${ff}, sans-serif`; ctx.textAlign = "center";
        ctx.fillText("+", PX + smallR, y + smallR + 4 * S);
      }
      ctx.font = `700 ${11 * S}px ${ff}, sans-serif`; ctx.fillStyle = "white"; ctx.textAlign = "left";
      ctx.fillText(handle, PX + circleR * 2 + 6 * S, y + circleR + 4 * S);
      y += circleR * 2 + 14 * S;

      // Title
      const titleSz = Math.round(31 * S * design.titleSize);
      const titleColor = slide.titleColor ?? "#ffffff";
      ctx.font = `900 ${titleSz}px ${ff}, sans-serif`;
      ctx.textAlign = "left";
      const ews = slide.wordStyles ?? [];
      const titleLines = _wrapCanvasText(ctx, slide.title.toUpperCase(), W - PX * 2);
      for (const line of titleLines) {
        _drawStyledLine(ctx, line, PX, y + titleSz * 0.82, titleSz, "900", ff, titleColor, ews, "left");
        y += titleSz * 1.1;
      }

      // Subtitle
      if (slide.body) {
        const subSz = 10 * S;
        ctx.font = `500 ${subSz}px ${ff}, sans-serif`;
        ctx.fillStyle = slide.bodyColor ?? "rgba(255,255,255,0.62)";
        ctx.fillText("→ " + slide.body, PX, y + subSz * 0.82 + 10 * S);
      }

      // Progress dots
      const dotY = H - 14 * S;
      const dotCount = slides.length;
      const dotGap = 7 * S;
      const activeW = 14 * S; const inactiveW = 5 * S;
      const totalDotsW = activeW + (dotCount - 1) * (inactiveW + dotGap);
      let dotX = (W - totalDotsW) / 2;
      for (let d = 0; d < dotCount; d++) {
        const dw = d === i ? activeW : inactiveW;
        ctx.fillStyle = d === i ? "white" : "rgba(255,255,255,0.3)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(dotX, dotY, dw, 2 * S, S);
        else ctx.rect(dotX, dotY, dw, 2 * S);
        ctx.fill();
        dotX += dw + dotGap;
      }

      // Counter
      ctx.font = `${9 * S}px ${ff}, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.textAlign = "right";
      ctx.fillText(`${i + 1}/${slides.length}`, W - PX, H - 10 * S);

    } else if (isCta) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Header
      const hdrY = 18 * S;
      ctx.font = `500 ${8 * S}px ${ff}, sans-serif`; ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.textAlign = "left"; ctx.fillText(`Powered by ${brand}`, PX, hdrY);
      ctx.textAlign = "center"; ctx.fillText(handle, W / 2, hdrY);
      ctx.textAlign = "right"; ctx.font = `700 ${8 * S}px ${ff}, sans-serif`; ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fillText(`${year} //`, W - PX, hdrY);
      ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(PX, 24 * S, W - PX * 2, S);

      // Center content
      const cx2 = W / 2;
      let y = H * 0.32;
      ctx.fillStyle = accent; ctx.fillRect(cx2 - 24 * S, y, 48 * S, 3 * S); y += 22 * S;

      const titleSz = Math.round(24 * S * design.titleSize);
      ctx.font = `900 ${titleSz}px ${ff}, sans-serif`; ctx.textAlign = "center";
      const ctaLines = _wrapCanvasText(ctx, slide.title, W - PX * 3);
      ctx.fillStyle = slide.titleColor ?? "#000";
      for (const line of ctaLines) { ctx.fillText(line, cx2, y + titleSz * 0.82); y += titleSz * 1.15; }
      y += 10 * S;

      if (slide.body) {
        const bsz = 12 * S;
        ctx.font = `${bsz}px ${ff}, sans-serif`; ctx.fillStyle = slide.bodyColor ?? "#555";
        const bLines = _wrapCanvasText(ctx, slide.body, W - PX * 3);
        for (const line of bLines) { ctx.fillText(line, cx2, y + bsz * 0.82); y += bsz * 1.55; }
        y += bsz;
      }

      if (slide.shortText) {
        const btnSz = 12 * S;
        ctx.font = `700 ${btnSz}px ${ff}, sans-serif`;
        const btnW = ctx.measureText(slide.shortText).width + 56 * S;
        const btnH = btnSz + 28 * S;
        ctx.fillStyle = accent;
        if (ctx.roundRect) ctx.roundRect(cx2 - btnW / 2, y, btnW, btnH, btnH / 2);
        else ctx.rect(cx2 - btnW / 2, y, btnW, btnH);
        ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(slide.shortText, cx2, y + btnH / 2 + btnSz * 0.38);
        y += btnH + 24 * S;
      }

      if (profileImg) {
        const imgSz = 28 * S;
        const badgeX = cx2 - imgSz / 2 - 30 * S;
        ctx.save(); ctx.beginPath(); ctx.arc(badgeX + imgSz / 2, y + imgSz / 2, imgSz / 2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(profileImg, badgeX, y, imgSz, imgSz); ctx.restore();
        ctx.font = `700 ${13 * S}px ${ff}, sans-serif`; ctx.fillStyle = "#000";
        ctx.textAlign = "left";
        ctx.fillText(handle, badgeX + imgSz + 8 * S, y + imgSz / 2 + 5 * S);
      }

    } else {
      // Content slides — alternating white (isTypeA) / dark (!isTypeA)
      const isDark = !isTypeA;
      ctx.fillStyle = isDark ? "#111111" : "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Header row
      const hdrY = 18 * S;
      const hdrFg = isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.28)";
      ctx.font = `500 ${8 * S}px ${ff}, sans-serif`; ctx.fillStyle = hdrFg;
      ctx.textAlign = "left"; ctx.fillText(`Powered by ${brand}`, PX, hdrY);
      ctx.textAlign = "center"; ctx.fillText(handle, W / 2, hdrY);
      ctx.textAlign = "right"; ctx.font = `700 ${8 * S}px ${ff}, sans-serif`;
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.42)";
      ctx.fillText(`${year} //`, W - PX, hdrY);
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
      ctx.fillRect(PX, 24 * S, W - PX * 2, S);

      // Accent bar
      let y = 34 * S + 12 * S;
      ctx.fillStyle = accent;
      ctx.fillRect(PX, y, 32 * S, 2 * S);
      y += 2 * S + 12 * S;

      // Title
      const tsz = Math.round(20 * S * design.titleSize);
      ctx.font = `800 ${tsz}px ${ff}, sans-serif`;
      ctx.fillStyle = slide.titleColor ?? (isDark ? "#ffffff" : "#000000");
      ctx.textAlign = "left";
      const tLines = _wrapCanvasText(ctx, slide.title, W - PX * 2);
      const contentWs = slide.wordStyles ?? [];
      for (const line of tLines) {
        _drawStyledLine(ctx, line, PX, y + tsz * 0.82, tsz, "800", ff, slide.titleColor ?? (isDark ? "#ffffff" : "#000000"), contentWs, "left");
        y += tsz * 1.2;
      }
      y += 8 * S;

      // Body text
      if (slide.body) {
        const bsz = 12 * S;
        ctx.font = `${bsz}px ${ff}, sans-serif`;
        ctx.fillStyle = slide.bodyColor ?? (isDark ? "rgba(255,255,255,0.68)" : "#333333");
        const bLines = _wrapCanvasText(ctx, slide.body, W - PX * 2);
        for (const line of bLines) { ctx.fillText(line, PX, y + bsz * 0.82); y += bsz * 1.65; }
        y += 8 * S;
      }

      // Image fills all remaining space
      const imgH = H - y - 10 * S;
      if (imgH > 60 * S && slide.imageUrl) {
        try {
          const img = await _loadImgCrossOrigin(resolveImgUrl(slide.imageUrl) ?? slide.imageUrl);
          const sc = Math.max((W - PX * 2) / img.naturalWidth, imgH / img.naturalHeight);
          const dw = img.naturalWidth * sc; const dh = img.naturalHeight * sc;
          ctx.save();
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(PX, y, W - PX * 2, imgH, 6 * S); ctx.clip(); }
          ctx.drawImage(img, PX + ((W - PX * 2) - dw) / 2, y + (imgH - dh) / 2, dw, dh);
          ctx.restore();
        } catch {
          ctx.fillStyle = isDark ? "#222222" : "#f0f0f0";
          ctx.fillRect(PX, y, W - PX * 2, imgH);
        }
      } else if (imgH > 60 * S) {
        ctx.fillStyle = isDark ? "#222222" : "#f0f0f0";
        ctx.fillRect(PX, y, W - PX * 2, imgH);
      }
    }

    results.push(canvas.toDataURL("image/jpeg", 0.95));
  }

  return results;
}

function formatDateLabel(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function buildProtoPayload(carousel: ProtoListItem) {
  return {
    topic: carousel.topic,
    style: carousel.style,
    hook: carousel.hook,
    caption: carousel.caption,
    finalCta: carousel.finalCta,
    slides: carousel.slides.map((s) => ({
      title: s.title,
      body: s.body ?? "",
      imageUrl: s.imageUrl,
      slideType: s.slideType,
      shortText: s.shortText,
      imagePrompt: s.imagePrompt,
      highlightWords: s.highlightWords,
      wordStyles: s.wordStyles,
    })),
  };
}

// ─── ProtoCarouselCard ────────────────────────────────────────────────────────

function ProtoCarouselCard({
  carousel,
  onEdit,
  onPublish,
  onSchedule,
  onDelete,
  isPublishing,
  isScheduling,
  isDeleting,
}: {
  carousel: ProtoListItem;
  onEdit: () => void;
  onPublish: () => void;
  onSchedule: () => void;
  onDelete: () => void;
  isPublishing: boolean;
  isScheduling: boolean;
  isDeleting: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  // coverImageUrl is set by the generate endpoint to slides[0].imageUrl — more reliable than slides[0].imageUrl directly
  const thumbUrl = carousel.coverImageUrl || carousel.slides[0]?.imageUrl || null;
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();
  const act = (e: React.MouseEvent<HTMLButtonElement>, fn: () => void) => {
    e.stopPropagation();
    fn();
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadCard = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);
    toast.loading("Gerando SVGs…", { id: "dl-zip" });
    try {
      const JSZip = (await import("jszip")).default;
      const design: DesignSettings = carousel.designSettings
        ? { ...DEFAULT_DESIGN, ...(carousel.designSettings as Partial<DesignSettings>) }
        : DEFAULT_DESIGN;
      const dataUrls = await renderSlidesToDataUrlsForTemplate(carousel.slides, design);
      const zip = new JSZip();
      dataUrls.forEach((dataUrl, i) => {
        const svgContent = [
          `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">`,
          `  <image xlink:href="${dataUrl}" x="0" y="0" width="1080" height="1350"/>`,
          `</svg>`,
        ].join("\n");
        zip.file(`slide-${String(i + 1).padStart(2, "0")}.svg`, svgContent);
      });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carrossel-${carousel.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${dataUrls.length} slides exportados!`, { id: "dl-zip" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao exportar: " + msg, { id: "dl-zip" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-[26px] border border-border/40 bg-background/75 p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* Thumbnail */}
      <div
        className="relative overflow-hidden rounded-[20px]"
        style={{ aspectRatio: "4/5", background: "#0d1117" }}
      >
        {thumbUrl && !imgFailed && (
          <img
            src={resolveImgUrl(thumbUrl)}
            className="absolute inset-0 w-full h-full object-cover"
            alt=""
            onError={() => setImgFailed(true)}
          />
        )}
        {(!thumbUrl || imgFailed) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0d1117 0%, #1a2030 100%)" }}
          >
            <Wand2 className="w-8 h-8 opacity-10" style={{ color: "#29d9ff" }} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: 3, background: "linear-gradient(90deg, #29d9ff, #29d9ff88)" }}
        />
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-[9px] font-medium uppercase tracking-[0.16em] text-white/60 mb-1">
            <span>Protótipo IA</span>
            <span>{carousel.slides.length} slides</span>
          </div>
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
            {carousel.topic}
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-2.5 px-0.5 pb-0.5 pt-3.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>Gancho</span>
          <span>{formatDateLabel(carousel.createdAt)}</span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
          {carousel.hook}
        </h3>

        {/* Editar + ZIP */}
        <div className="flex gap-2 pt-0.5">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            onPointerDown={stopProp}
            onMouseDown={stopProp}
            onClick={(e) => act(e, onEdit)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isDownloading}
            onPointerDown={stopProp}
            onMouseDown={stopProp}
            onClick={handleDownloadCard}
          >
            {isDownloading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            ZIP
          </Button>
        </div>

        {/* Postar + Agendar */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            onPointerDown={stopProp}
            onMouseDown={stopProp}
            onClick={(e) => act(e, onPublish)}
            disabled={isPublishing || isScheduling}
          >
            {isPublishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            )}
            Postar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-blue-500/30 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
            onPointerDown={stopProp}
            onMouseDown={stopProp}
            onClick={(e) => act(e, onSchedule)}
            disabled={isPublishing || isScheduling}
          >
            {isScheduling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="mr-2 h-4 w-4" />
            )}
            Agendar
          </Button>
        </div>

        {/* Excluir */}
        <Button
          type="button"
          variant="outline"
          className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onPointerDown={stopProp}
          onMouseDown={stopProp}
          onClick={(e) => act(e, onDelete)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Excluir
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PrototipoCarrossel() {
  const [phase, setPhase] = useState<Phase>("list");
  const [inputMode, setInputMode] = useState<InputMode>("topic");
  const [topic, setTopic] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const [format, setFormat] = useState<"feed" | "story">("feed");
  const [tone, setTone] = useState<"educativo" | "viral" | "vendas">("viral");
  const [genStep, setGenStep] = useState(0);
  const [result, setResult] = useState<ProtoResult | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [design, setDesign] = useState<DesignSettings>(loadSavedDesign);
  const [processingCarouselId, setProcessingCarouselId] = useState<number | null>(null);
  const [scheduleCarousel, setScheduleCarousel] = useState<ProtoListItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [canvaSearch, setCanvaSearch] = useState("");
  const [canvaSearchInput, setCanvaSearchInput] = useState("");
  const [highlightInput, setHighlightInput] = useState("");
  const [namedPresets, setNamedPresets] = useState<NamedDesignPreset[]>(loadNamedPresets);
  const [newPresetName, setNewPresetName] = useState("");

  // ── Instagram style agent ──────────────────────────────────────────────────
  const [igStyleOpen, setIgStyleOpen] = useState(false);
  const [igStyleInput, setIgStyleInput] = useState("");
  const [igStyleResult, setIgStyleResult] = useState<IgStyleAnalysis | null>(null);
  const [canvaExportingId, setCanvaExportingId] = useState<string | null>(null);
  const [isUploadingSlideImg, setIsUploadingSlideImg] = useState(false);
  const slideImgInputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const utils = trpc.useUtils();

  const toneProfile: Record<string, string> = {
    educativo: "brandsdecoded-claude",
    viral: "krythos",
    vendas: "alle-laranja",
  };

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: allCarousels = [], isLoading: isLoadingList } = trpc.carousel.getAll.useQuery();
  const protoCarousels = (allCarousels as ProtoListItem[]).filter(
    (c) => c.style === "proto-moderno"
  );

  const { data: canvaConnection, refetch: refetchCanvaConnection } = trpc.canva.getConnection.useQuery(undefined, {
    retry: false,
  });
  const { data: canvaDesigns, isLoading: isLoadingCanvaDesigns, refetch: refetchCanvaDesigns } =
    trpc.canva.listDesigns.useQuery(
      { query: canvaSearch || undefined, limit: 20 },
      { enabled: !!canvaConnection, retry: false }
    );
  const canvaDisconnectMutation = trpc.canva.disconnect.useMutation({
    onSuccess: () => { void refetchCanvaConnection(); toast.success("Canva desconectado."); },
  });
  const canvaExportMutation = trpc.canva.exportDesign.useMutation({
    onError: (e) => { toast.error(`Erro ao exportar: ${e.message}`); setCanvaExportingId(null); },
  });
  const canvaCreateMutation = trpc.canva.createDesign.useMutation({
    onSuccess: (data) => {
      if (data.editUrl) {
        window.open(data.editUrl, "_blank");
        if (result) {
          setResult((prev) => {
            if (!prev) return prev;
            const slides = [...prev.slides];
            slides[activeIdx] = { ...slides[activeIdx], canvaDesignId: data.id };
            return { ...prev, slides };
          });
          toast.success("Design criado! Edite no Canva e volte para importar.");
        }
      }
    },
    onError: (e) => toast.error(`Erro ao criar design: ${e.message}`),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const generateMutation = trpc.carousel.generate.useMutation({
    onSuccess: (data) => {
      timersRef.current.forEach(clearTimeout);
      setResult({
        id: data.id,
        topic: data.topic,
        slides: data.slides as ProtoSlide[],
        caption: data.caption,
        hook: data.hook,
        finalCta: data.finalCta,
      });
      setActiveIdx(0);
      setPhase("preview");
      utils.carousel.getAll.invalidate();
    },
    onError: (err) => {
      timersRef.current.forEach(clearTimeout);
      const isTimeout =
        err.message.toLowerCase().includes("aborted") ||
        err.message.toLowerCase().includes("timeout");
      toast.error(
        isTimeout
          ? "A IA demorou mais que o esperado. Tente novamente."
          : "Erro ao gerar: " + err.message
      );
      setPhase("form");
    },
  });

  const fetchArticleMutation = trpc.carousel.fetchArticle.useMutation({
    onSuccess: (data) => {
      setPhase("generating");
      setGenStep(0);
      startStepTimers();
      generateMutation.mutate({
        topic: data.topic,
        slideCount,
        style: "proto-moderno",
        carouselFormat: format,
        profileId: toneProfile[tone],
        articleContext: data.articleContext?.slice(0, 4900),
      });
    },
    onError: (err) => {
      const isTimeout =
        err.message.toLowerCase().includes("aborted") ||
        err.message.toLowerCase().includes("timeout");
      toast.error(
        isTimeout
          ? "A requisição demorou demais. Verifique o link e tente novamente."
          : "Erro ao acessar notícia: " + err.message
      );
      setPhase("form");
    },
  });

  const regenImageMutation = trpc.carousel.regenerateSlideImage.useMutation({
    onSuccess: (data, vars) => {
      if (!result) return;
      const newSlides = result.slides.map((s, i) =>
        i === vars.slideIndex ? { ...s, imageUrl: data.imageUrl } : s
      );
      setResult({ ...result, slides: newSlides });
      toast.success("Imagem atualizada!");
    },
    onError: () => toast.error("Erro ao trocar imagem"),
  });

  const saveMutation = trpc.carousel.updateContent.useMutation();

  const publishInstagramMutation = trpc.carousel.publishInstagram.useMutation();

  const scheduleInstagramMutation = trpc.carousel.scheduleInstagram.useMutation({
    onSuccess: () => {
      utils.posts.getAll.invalidate();
      utils.posts.getStats.invalidate();
    },
  });

  const uploadRenderedMutation = trpc.carousel.uploadRenderedSlides.useMutation();

  const analyzeIgStyleMutation = trpc.carousel.analyzeInstagramProfile.useMutation({
    onSuccess: (data) => setIgStyleResult(data as IgStyleAnalysis),
    onError: (err) => toast.error("Erro ao analisar perfil: " + err.message),
  });

  const deleteMutation = trpc.carousel.delete.useMutation({
    onSuccess: () => {
      utils.carousel.getAll.invalidate();
      toast.success("Carrossel excluído.");
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message),
  });

  // ── Canva helpers ──────────────────────────────────────────────────────────

  const openCanvaDesignInTab = useCallback((designId: string) => {
    window.open(`https://www.canva.com/design/${designId}/edit`, "_blank");
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const startStepTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    let step = 0;
    const advance = () => {
      step++;
      if (step < GEN_STEPS.length) {
        setGenStep(step);
        const t = setTimeout(advance, GEN_STEP_DURATIONS[step]);
        timersRef.current.push(t);
      }
    };
    const t0 = setTimeout(advance, GEN_STEP_DURATIONS[0]);
    timersRef.current.push(t0);
  }, []);

  const startGeneration = () => {
    if (inputMode === "topic") {
      if (!topic.trim()) { toast.error("Digite um tema"); return; }
      setPhase("generating");
      setGenStep(0);
      startStepTimers();
      generateMutation.mutate({
        topic: topic.trim(),
        slideCount,
        style: "proto-moderno",
        carouselFormat: format,
        profileId: toneProfile[tone],
      });
    } else {
      if (!articleUrl.trim()) { toast.error("Cole o link da notícia"); return; }
      setPhase("fetching");
      fetchArticleMutation.mutate({ url: articleUrl.trim() });
    }
  };

  const addHighlightWord = () => {
    const word = highlightInput.trim();
    if (!word || !result) return;
    setResult((prev) => {
      if (!prev) return prev;
      const slides = [...prev.slides];
      const current = slides[activeIdx].wordStyles ?? [];
      if (current.some((w) => w.word.toLowerCase() === word.toLowerCase())) return prev;
      slides[activeIdx] = { ...slides[activeIdx], wordStyles: [...current, { word, color: design.accentColor }] };
      return { ...prev, slides };
    });
    setHighlightInput("");
  };

  const removeHighlightWord = (idx: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const slides = [...prev.slides];
      slides[activeIdx] = { ...slides[activeIdx], wordStyles: (slides[activeIdx].wordStyles ?? []).filter((_, i) => i !== idx) };
      return { ...prev, slides };
    });
  };

  const updateWordStyle = (idx: number, patch: Partial<WordStyle>) => {
    setResult((prev) => {
      if (!prev) return prev;
      const slides = [...prev.slides];
      const ws = [...(slides[activeIdx].wordStyles ?? [])];
      ws[idx] = { ...ws[idx], ...patch };
      slides[activeIdx] = { ...slides[activeIdx], wordStyles: ws };
      return { ...prev, slides };
    });
  };

  const saveWithAWS = async () => {
    if (!result || saveMutation.isPending || uploadRenderedMutation.isPending) return;
    try {
      // Step 1: save text + design settings
      toast.loading("Salvando…", { id: "save-flow" });
      await saveMutation.mutateAsync({
        id: result.id,
        hook: result.hook,
        caption: result.caption,
        finalCta: result.finalCta,
        slides: result.slides.map((s) => ({
          title: s.title,
          body: s.body ?? "",
          imageUrl: s.imageUrl,
          renderedImageUrl: s.renderedImageUrl,
          slideType: s.slideType,
          shortText: s.shortText,
          imagePrompt: s.imagePrompt,
          highlightWords: s.highlightWords,
          wordStyles: s.wordStyles,
          titleColor: s.titleColor,
          bodyColor: s.bodyColor,
        })),
        designSettings: design as unknown as Record<string, unknown>,
      });

      // Step 2: render slides with current design → data URLs
      toast.loading("Renderizando slides…", { id: "save-flow" });
      const dataUrls = await renderSlidesToDataUrlsForTemplate(result.slides, design);

      // Step 3: upload rendered images to public storage
      toast.loading("Enviando imagens…", { id: "save-flow" });
      const { urls } = await uploadRenderedMutation.mutateAsync({
        carouselId: result.id,
        dataUrls,
      });

      // Step 4: persist rendered URLs back to the carousel
      const slidesWithRendered = result.slides.map((s, i) => ({
        ...s,
        renderedImageUrl: urls[i] ?? s.renderedImageUrl,
      }));
      await saveMutation.mutateAsync({
        id: result.id,
        hook: result.hook,
        caption: result.caption,
        finalCta: result.finalCta,
        slides: slidesWithRendered.map((s) => ({
          title: s.title,
          body: s.body ?? "",
          imageUrl: s.imageUrl,
          renderedImageUrl: s.renderedImageUrl,
          slideType: s.slideType,
          shortText: s.shortText,
          imagePrompt: s.imagePrompt,
          highlightWords: s.highlightWords,
          wordStyles: s.wordStyles,
          titleColor: s.titleColor,
          bodyColor: s.bodyColor,
        })),
        designSettings: design as unknown as Record<string, unknown>,
      });

      setResult({ ...result, slides: slidesWithRendered });
      saveDesignAsDefault(design);
      utils.carousel.getAll.invalidate();
      toast.success("Salvo e pronto para publicar!", { id: "save-flow" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao salvar: " + msg, { id: "save-flow" });
    }
  };

  const copyCaption = () => {
    if (result?.caption) {
      navigator.clipboard.writeText(result.caption);
      toast.success("Legenda copiada!");
    }
  };

  const goToList = () => {
    setPhase("list");
    setResult(null);
    setActiveIdx(0);
    utils.carousel.getAll.invalidate();
  };

  const handleEditCard = (carousel: ProtoListItem) => {
    setResult({
      id: carousel.id,
      topic: carousel.topic,
      slides: carousel.slides,
      caption: carousel.caption,
      hook: carousel.hook,
      finalCta: carousel.finalCta,
    });
    setActiveIdx(0);
    setDesign(
      carousel.designSettings
        ? { ...DEFAULT_DESIGN, ...carousel.designSettings }
        : loadSavedDesign()
    );
    setPhase("preview");
  };

  const handlePublishInstagram = async (carousel: ProtoListItem) => {
    setProcessingCarouselId(carousel.id);
    try {
      const payload = buildProtoPayload(carousel);

      // If all slides already have public rendered URLs, use them directly as imageUrl
      // (the Instagram agent accepts public https:// URLs on imageUrl without needing a data URL)
      const allPreRendered = carousel.slides.every((s) => s.renderedImageUrl);
      if (allPreRendered) {
        toast.loading("Enviando para o Instagram…", { id: "insta-pub" });
        const result = await publishInstagramMutation.mutateAsync({
          ...payload,
          slides: payload.slides.map((s, i) => ({
            ...s,
            imageUrl: carousel.slides[i]!.renderedImageUrl ?? s.imageUrl,
          })),
        });
        toast.success(`Publicado! Media ID: ${result.mediaId}`, { id: "insta-pub" });
        return;
      }

      // No pre-rendered URLs — render now with the carousel's saved design
      const designToUse = carousel.designSettings
        ? { ...DEFAULT_DESIGN, ...carousel.designSettings }
        : DEFAULT_DESIGN;
      toast.loading("Renderizando slides…", { id: "insta-pub" });
      const dataUrls = await renderSlidesToDataUrlsForTemplate(carousel.slides, designToUse);

      toast.loading("Enviando para o Instagram…", { id: "insta-pub" });
      const result = await publishInstagramMutation.mutateAsync({
        ...payload,
        slides: payload.slides.map((s, i) => ({
          ...s,
          imageDataUrl: dataUrls[i],
        })),
      });
      toast.success(`Publicado! Media ID: ${result.mediaId}`, { id: "insta-pub" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao postar: " + msg, { id: "insta-pub" });
    } finally {
      setProcessingCarouselId(null);
    }
  };

  const openScheduleDialog = (carousel: ProtoListItem) => {
    setScheduleCarousel(carousel);
    setScheduleDate(toSchedulerDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
  };

  const handleScheduleInstagram = async () => {
    if (!scheduleCarousel) return;
    const scheduledAt = scheduleDate.trim();
    if (!scheduledAt) { toast.error("Escolha uma data e hora para agendar."); return; }
    if (!isSchedulerDatetimeLocalInFuture(scheduledAt)) {
      toast.error("Escolha uma data futura para agendar.");
      return;
    }
    setProcessingCarouselId(scheduleCarousel.id);
    try {
      const scheduleDesign = scheduleCarousel.designSettings
        ? { ...DEFAULT_DESIGN, ...scheduleCarousel.designSettings }
        : DEFAULT_DESIGN;
      const allPreRendered = scheduleCarousel.slides.every((s) => s.renderedImageUrl);

      let urls: string[];
      if (allPreRendered) {
        urls = scheduleCarousel.slides.map((s) => s.renderedImageUrl!);
      } else {
        toast.loading("Renderizando slides…", { id: "insta-sched" });
        const dataUrls = await renderSlidesToDataUrlsForTemplate(scheduleCarousel.slides, scheduleDesign);
        toast.loading("Salvando imagens na nuvem…", { id: "insta-sched" });
        ({ urls } = await uploadRenderedMutation.mutateAsync({
          carouselId: scheduleCarousel.id,
          dataUrls,
        }));
      }

      toast.loading("Agendando…", { id: "insta-sched" });
      const payload = buildProtoPayload(scheduleCarousel);
      await scheduleInstagramMutation.mutateAsync({
        ...payload,
        slides: payload.slides.map((s, i) => ({
          ...s,
          imageUrl: urls[i] ?? s.imageUrl,
        })),
        scheduledAt,
      });
      toast.success("Carrossel agendado para o Instagram.", { id: "insta-sched" });
      setScheduleCarousel(null);
      setScheduleDate("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao agendar: " + msg, { id: "insta-sched" });
    } finally {
      setProcessingCarouselId(null);
    }
  };

  const isScheduling = scheduleInstagramMutation.isPending;

  // ── LIST ───────────────────────────────────────────────────────────────────

  if (phase === "list") {
    return (
      <AppLayout activeModule="prototipo">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #29d9ff, #0ea5e9)" }}
              >
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-foreground tracking-tight">Protótipo Carrossel</h1>
                <p className="text-xs text-muted-foreground">
                  {protoCarousels.length} carrossel{protoCarousels.length !== 1 ? "s" : ""} gerado{protoCarousels.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setPhase("form")}
              className="gap-2 text-white border-0 font-bold shadow-md"
              style={{ background: "linear-gradient(135deg, #29d9ff, #0ea5e9)" }}
            >
              <Plus className="w-4 h-4" />
              Novo Carrossel
            </Button>
          </div>

          {/* ── Instagram Style Agent ──────────────────────────────────── */}
          <div className="mb-6 rounded-2xl border border-border/50 overflow-hidden" style={{ background: "rgba(41,217,255,0.04)" }}>
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left"
              onClick={() => { setIgStyleOpen((o) => !o); setIgStyleResult(null); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#29d9ff22,#0ea5e922)" }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#29d9ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#29d9ff" stroke="none"/></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-tight">Analisar Estilo do Instagram</p>
                  <p className="text-xs text-muted-foreground leading-tight">IA extrai cores, fonte e identidade visual do perfil</p>
                </div>
              </div>
              <svg className={`w-4 h-4 text-muted-foreground transition-transform ${igStyleOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>

            {igStyleOpen && (
              <div className="px-5 pb-5 border-t border-border/30 pt-4 space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="@usuario ou link do perfil"
                    value={igStyleInput}
                    onChange={(e) => setIgStyleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && igStyleInput.trim() && !analyzeIgStyleMutation.isPending) {
                        analyzeIgStyleMutation.mutate({ usernameOrUrl: igStyleInput.trim() });
                      }
                    }}
                    className="flex-1 h-9 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={!igStyleInput.trim() || analyzeIgStyleMutation.isPending}
                    onClick={() => analyzeIgStyleMutation.mutate({ usernameOrUrl: igStyleInput.trim() })}
                    className="h-9 px-4 text-xs font-bold border-0 text-white shrink-0"
                    style={{ background: "linear-gradient(135deg,#29d9ff,#0ea5e9)" }}
                  >
                    {analyzeIgStyleMutation.isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : "Analisar"}
                  </Button>
                </div>

                {analyzeIgStyleMutation.isPending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#29d9ff" }} />
                    Analisando perfil com IA…
                  </div>
                )}

                {igStyleResult && (
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    {/* Preview strip */}
                    <div className="h-12 flex items-center gap-3 px-4" style={{ background: igStyleResult.bgColor }}>
                      {igStyleResult.profileImageUrl && (
                        <img
                          src={resolveImgUrl(igStyleResult.profileImageUrl)}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          style={{ border: `2px solid ${igStyleResult.accentColor}` }}
                        />
                      )}
                      <div>
                        <p className="text-xs font-bold leading-tight" style={{ color: "#ffffff", fontFamily: igStyleResult.fontFamily }}>{igStyleResult.profileName}</p>
                        <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>{igStyleResult.profileHandle}</p>
                      </div>
                      <div className="ml-auto flex gap-1.5">
                        {[igStyleResult.accentColor, igStyleResult.bgColor].map((c, i) => (
                          <div key={i} className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0" style={{ background: c }} title={c} />
                        ))}
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3 space-y-1.5">
                      {igStyleResult.niche && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: igStyleResult.accentColor }}>{igStyleResult.niche}</p>
                      )}
                      <p className="text-xs text-foreground leading-relaxed">{igStyleResult.styleSummary}</p>
                      <p className="text-[11px] text-muted-foreground italic">{igStyleResult.toneDescription}</p>
                      {/* Carousel slide style comparison */}
                      {(igStyleResult.coverSlideStyle || igStyleResult.contentSlideStyle) && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {igStyleResult.coverSlideStyle && (
                            <div className="rounded-lg overflow-hidden border border-border/30">
                              <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: igStyleResult.coverSlideStyle.bgColor }}>
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: igStyleResult.coverSlideStyle.accentColor }} />
                                <span className="text-[9px] font-bold uppercase tracking-wider text-white/80">Capa</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground px-2 py-1.5 leading-relaxed">{igStyleResult.coverSlideStyle.description}</p>
                            </div>
                          )}
                          {igStyleResult.contentSlideStyle && (
                            <div className="rounded-lg overflow-hidden border border-border/30">
                              <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: igStyleResult.contentSlideStyle.bgColor }}>
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: igStyleResult.contentSlideStyle.accentColor }} />
                                <span className="text-[9px] font-bold uppercase tracking-wider text-white/80">Slides</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground px-2 py-1.5 leading-relaxed">{igStyleResult.contentSlideStyle.description}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="px-3 pb-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs font-bold border-0 text-white"
                        style={{ background: igStyleResult.accentColor }}
                        onClick={() => {
                          const preset: NamedDesignPreset = {
                            presetName: igStyleResult.profileHandle,
                            accentColor: igStyleResult.contentSlideStyle?.accentColor ?? igStyleResult.accentColor,
                            bgColor: igStyleResult.contentSlideStyle?.bgColor ?? igStyleResult.bgColor,
                            fontFamily: igStyleResult.fontFamily,
                            titleAlign: igStyleResult.contentSlideStyle?.titleAlign ?? igStyleResult.titleAlign,
                            titleSize: igStyleResult.titleSize,
                            profileName: igStyleResult.profileName,
                            profileHandle: igStyleResult.profileHandle,
                            profileImageUrl: igStyleResult.profileImageUrl,
                            coverBgColor: igStyleResult.coverSlideStyle?.bgColor,
                            coverAccentColor: igStyleResult.coverSlideStyle?.accentColor,
                            coverTitleAlign: igStyleResult.coverSlideStyle?.titleAlign,
                          };
                          persistNamedPreset(preset);
                          setNamedPresets(loadNamedPresets());
                          setDesign(preset);
                          saveDesignAsDefault(preset);
                          toast.success(`Preset "${preset.presetName}" salvo e ativado!`);
                          setIgStyleOpen(false);
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Usar estilo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setIgStyleResult(null)}
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* List */}
          {isLoadingList ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#29d9ff" }} />
            </div>
          ) : protoCarousels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-xl mb-4"
                style={{ background: "linear-gradient(135deg, #29d9ff22, #0ea5e922)" }}
              >
                <Sparkles className="w-8 h-8" style={{ color: "#29d9ff" }} />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">Nenhum carrossel ainda</h2>
              <p className="text-muted-foreground text-sm mb-5 max-w-xs">
                Crie seu primeiro carrossel profissional com IA em segundos.
              </p>
              <Button
                onClick={() => setPhase("form")}
                className="gap-2 text-white border-0 font-bold"
                style={{ background: "linear-gradient(135deg, #29d9ff, #0ea5e9)" }}
              >
                <Plus className="w-4 h-4" />
                Criar agora
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {protoCarousels.map((carousel) => (
                <ProtoCarouselCard
                  key={carousel.id}
                  carousel={carousel}
                  onEdit={() => handleEditCard(carousel)}
                  onPublish={() => handlePublishInstagram(carousel)}
                  onSchedule={() => openScheduleDialog(carousel)}
                  onDelete={() => deleteMutation.mutate({ id: carousel.id })}
                  isPublishing={processingCarouselId === carousel.id}
                  isScheduling={processingCarouselId === carousel.id && scheduleInstagramMutation.isPending}
                  isDeleting={deleteMutation.isPending && (deleteMutation.variables as { id: number } | undefined)?.id === carousel.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Schedule dialog */}
        <Dialog
          open={!!scheduleCarousel}
          onOpenChange={(open) => {
            if (!open) { setScheduleCarousel(null); setScheduleDate(""); }
          }}
        >
          <DialogContent className="w-[min(92vw,480px)] border-border/50 bg-background">
            <DialogTitle>Agendar Instagram</DialogTitle>
            <DialogDescription>
              Escolha quando este carrossel deve ser publicado no Instagram.
            </DialogDescription>
            <div className="space-y-4 pt-2">
              {scheduleCarousel && (
                <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {scheduleCarousel.hook || scheduleCarousel.topic}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {scheduleCarousel.slides.length} slides
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Data e hora ({POST_SCHEDULER_TIME_ZONE})
                </label>
                <Input
                  type="datetime-local"
                  value={scheduleDate}
                  min={toSchedulerDatetimeLocalValue(new Date())}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setScheduleCarousel(null); setScheduleDate(""); }}
                  disabled={isScheduling}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2 bg-blue-600 text-white hover:bg-blue-700"
                  onClick={handleScheduleInstagram}
                  disabled={isScheduling || processingCarouselId !== null || !scheduleDate}
                >
                  {isScheduling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  Agendar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }

  // ── FORM ───────────────────────────────────────────────────────────────────

  if (phase === "form") {
    return (
      <AppLayout activeModule="prototipo">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-xl">
            {/* Back */}
            <button
              onClick={() => setPhase("list")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar à lista
            </button>

            {/* Header */}
            <div className="text-center mb-7">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-xl mb-4"
                style={{ background: "linear-gradient(135deg, #29d9ff, #0ea5e9)" }}
              >
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Novo Carrossel</h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Gere carrosséis profissionais em segundos com IA
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-5">
              {/* Mode toggle */}
              <div className="flex gap-1.5 p-1 rounded-xl bg-muted/40">
                <button
                  onClick={() => setInputMode("topic")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all",
                    inputMode === "topic"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Tema livre
                </button>
                <button
                  onClick={() => setInputMode("url")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all",
                    inputMode === "url"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  A partir de notícia
                </button>
              </div>

              {/* Input */}
              {inputMode === "topic" ? (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Tema do carrossel
                  </label>
                  <Textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: 3 erros que impedem seu negócio de crescer nas redes sociais"
                    className="resize-none min-h-[88px] text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) startGeneration();
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Temas específicos geram resultados mais impactantes · Ctrl+Enter para gerar
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Link da notícia ou artigo
                  </label>
                  <Input
                    value={articleUrl}
                    onChange={(e) => setArticleUrl(e.target.value)}
                    placeholder="https://exemplo.com/noticia"
                    className="text-sm"
                    type="url"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    O agente acessa o conteúdo, extrai os dados e gera o carrossel automaticamente
                  </p>
                </div>
              )}

              {/* Slide count */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-sm font-semibold text-foreground">Quantidade de slides</label>
                  <span className="text-sm font-bold" style={{ color: "#29d9ff" }}>
                    {slideCount} slides
                  </span>
                </div>
                <div className="flex gap-2">
                  {[3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSlideCount(n)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
                        slideCount === n
                          ? "text-white shadow-md"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      style={slideCount === n ? { background: "#29d9ff", color: "#0d1117" } : {}}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Formato</label>
                <div className="flex gap-1.5 p-1 rounded-xl bg-muted/40">
                  {(["feed", "story"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
                        format === f
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f === "feed" ? "Feed (4:5)" : "Story (9:16)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Tom do conteúdo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "educativo", label: "Educativo", desc: "Didático · Autoridade" },
                    { id: "viral", label: "Viral", desc: "Hooks fortes · Engaja" },
                    { id: "vendas", label: "Vendas", desc: "Conversão · Direto" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTone(item.id as typeof tone)}
                      className={cn(
                        "p-3 rounded-xl text-left transition-all border",
                        tone === item.id
                          ? "border-cyan-500/60 bg-cyan-500/10 text-foreground"
                          : "border-border/30 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border/60"
                      )}
                    >
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-[11px] mt-0.5 opacity-60">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <Button
                onClick={startGeneration}
                disabled={
                  generateMutation.isPending ||
                  fetchArticleMutation.isPending ||
                  (inputMode === "topic" ? !topic.trim() : !articleUrl.trim())
                }
                className="w-full h-12 text-base font-bold text-white border-0 rounded-xl shadow-lg"
                style={{ background: "linear-gradient(135deg, #29d9ff, #0ea5e9)" }}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {inputMode === "url" ? "Gerar a partir da notícia" : "Gerar Carrossel"}
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── FETCHING (article) ─────────────────────────────────────────────────────

  if (phase === "fetching") {
    return (
      <AppLayout activeModule="prototipo">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-xl mb-6 animate-pulse"
              style={{ background: "linear-gradient(135deg, #29d9ff, #0ea5e9)" }}
            >
              <Link2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-1">Lendo a notícia</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto truncate">
              {articleUrl}
            </p>
            <div className="glass-card rounded-2xl p-5 space-y-3 text-left">
              {["Acessando a página...", "Extraindo conteúdo...", "Preparando para geração..."].map(
                (step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {i === 0 ? (
                      <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "#29d9ff" }} />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border/40 flex-shrink-0" />
                    )}
                    <span className={cn("text-sm", i === 0 ? "text-foreground font-medium" : "text-muted-foreground/40")}>
                      {step}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── GENERATING ─────────────────────────────────────────────────────────────

  if (phase === "generating") {
    return (
      <AppLayout activeModule="prototipo">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-xl mb-6 animate-pulse"
              style={{ background: "linear-gradient(135deg, #29d9ff, #0ea5e9)" }}
            >
              <Wand2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-1">Gerando carrossel</h2>
            <p className="text-muted-foreground text-sm mb-7 max-w-xs mx-auto truncate">
              "{inputMode === "url" ? articleUrl : topic}"
            </p>
            <div className="glass-card rounded-2xl p-5 space-y-3 text-left">
              {GEN_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  {i < genStep ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#29d9ff" }} />
                  ) : i === genStep ? (
                    <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "#29d9ff" }} />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-border/40 flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      i < genStep ? "text-muted-foreground/50 line-through" :
                      i === genStep ? "text-foreground font-medium" : "text-muted-foreground/40"
                    )}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── PREVIEW ────────────────────────────────────────────────────────────────

  if (!result) return null;
  const activeSlide = result.slides[activeIdx];

  return (
    <AppLayout activeModule="prototipo">
      <div className="flex" style={{ height: "100vh" }}>

        {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
        <div className="flex-none w-[272px] border-r border-border/30 flex flex-col overflow-hidden bg-background">

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 shrink-0">
            <button onClick={goToList} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs truncate leading-tight">{result.topic}</p>
              <p className="text-[10px] text-muted-foreground">{result.slides.length} slides</p>
            </div>
            <Button size="sm" onClick={saveWithAWS} disabled={saveMutation.isPending || uploadRenderedMutation.isPending}
              className="h-7 px-2.5 text-xs gap-1 shrink-0 border-0"
              style={{ background: design.accentColor, color: "#0d1117" }}>
              {(saveMutation.isPending || uploadRenderedMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar
            </Button>
          </div>

          {/* Scrollable panel content */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">

            {/* Slide editing */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Slide {activeIdx + 1}</span>
                {activeSlide.slideType && (
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    activeSlide.slideType === "hook" ? "bg-orange-500/15 text-orange-400" :
                    activeSlide.slideType === "cta" ? "bg-cyan-500/15 text-cyan-400" :
                    "bg-violet-500/15 text-violet-400")}>
                    {activeSlide.slideType === "hook" ? "Gancho" : activeSlide.slideType === "cta" ? "CTA" : "Conteúdo"}
                  </span>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Título</label>
                <Textarea value={activeSlide.title}
                  onChange={(e) => setResult((prev) => { if (!prev) return prev; const s = [...prev.slides]; s[activeIdx] = { ...s[activeIdx], title: e.target.value }; return { ...prev, slides: s }; })}
                  className="resize-none text-sm min-h-[64px]" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Texto</label>
                <Textarea value={activeSlide.body ?? ""}
                  onChange={(e) => setResult((prev) => { if (!prev) return prev; const s = [...prev.slides]; s[activeIdx] = { ...s[activeIdx], body: e.target.value }; return { ...prev, slides: s }; })}
                  className="resize-none text-sm min-h-[64px]" />
              </div>
              {/* Font colors */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Cor do texto</label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Título</span>
                    <input type="color" value={activeSlide.titleColor ?? "#ffffff"}
                      onChange={(e) => setResult((prev) => { if (!prev) return prev; const s = [...prev.slides]; s[activeIdx] = { ...s[activeIdx], titleColor: e.target.value }; return { ...prev, slides: s }; })}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-border/30 p-0.5 bg-transparent" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Corpo</span>
                    <input type="color" value={activeSlide.bodyColor ?? "#cccccc"}
                      onChange={(e) => setResult((prev) => { if (!prev) return prev; const s = [...prev.slides]; s[activeIdx] = { ...s[activeIdx], bodyColor: e.target.value }; return { ...prev, slides: s }; })}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-border/30 p-0.5 bg-transparent" />
                  </div>
                </div>
              </div>

              {/* Word styles */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Palavras com estilo
                </label>
                {/* Title word chips — click to add */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {[...new Set(activeSlide.title.split(/\s+/).filter(Boolean))].map((word) => {
                    const already = (activeSlide.wordStyles ?? []).some((ws) => ws.word.toLowerCase() === word.toLowerCase());
                    return (
                      <button key={word} disabled={already}
                        onClick={() => { setHighlightInput(word); }}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                          already
                            ? "border-transparent text-muted-foreground/30 cursor-default"
                            : "border-border/60 text-muted-foreground bg-muted/30 hover:text-foreground hover:border-border"
                        )}>
                        {word}
                      </button>
                    );
                  })}
                </div>
                {/* Styled words list */}
                <div className="space-y-1.5 mb-2">
                  {(activeSlide.wordStyles ?? []).map((ws, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-muted/20 rounded-lg px-2 py-1">
                      <span className="text-xs font-semibold flex-1 truncate"
                        style={{ color: ws.color ?? design.accentColor, fontWeight: ws.bold ? 900 : undefined, fontStyle: ws.italic ? "italic" : undefined }}>
                        {ws.word}
                      </span>
                      <input type="color" value={ws.color ?? design.accentColor}
                        onChange={(e) => updateWordStyle(i, { color: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent flex-shrink-0" />
                      <button onClick={() => updateWordStyle(i, { bold: !ws.bold })}
                        className={cn("w-6 h-6 rounded text-xs font-black flex items-center justify-center transition-colors flex-shrink-0",
                          ws.bold ? "text-black" : "bg-muted/50 text-muted-foreground")}
                        style={ws.bold ? { background: design.accentColor } : undefined}>
                        B
                      </button>
                      <button onClick={() => updateWordStyle(i, { italic: !ws.italic })}
                        className={cn("w-6 h-6 rounded text-xs italic flex items-center justify-center transition-colors flex-shrink-0",
                          ws.italic ? "text-black" : "bg-muted/50 text-muted-foreground")}
                        style={ws.italic ? { background: design.accentColor } : undefined}>
                        I
                      </button>
                      <button onClick={() => removeHighlightWord(i)}
                        className="w-5 h-5 flex items-center justify-center rounded opacity-40 hover:opacity-100 transition-opacity flex-shrink-0 text-xs">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {/* Add word input */}
                <div className="flex gap-1.5">
                  <input
                    className="flex-1 h-7 rounded-md border border-border/40 bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="Digite ou clique na palavra acima…"
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHighlightWord(); } }}
                  />
                  <Button size="sm" className="h-7 px-3 text-xs border-0 shrink-0"
                    style={{ background: design.accentColor, color: "#0d1117" }}
                    onClick={addHighlightWord}>+</Button>
                </div>
              </div>

              <button onClick={copyCaption}
                className="w-full text-xs font-medium flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground">
                <Copy className="w-3 h-3" /> Copiar legenda
              </button>
            </div>

            {/* Design */}
            <div className="p-4 space-y-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Template visual</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "dark", label: "Dark", desc: "Foto full-bleed, texto sobre imagem" },
                  { id: "editorial", label: "Editorial", desc: "Capa dark + slides brancos estilo revista" },
                ] as const).map((t) => {
                  const active = (design.template ?? "dark") === t.id;
                  return (
                    <button key={t.id}
                      onClick={() => { const d = { ...design, template: t.id }; setDesign(d); saveDesignAsDefault(d); }}
                      className={cn("p-2.5 rounded-xl text-left transition-all border", active
                        ? "border-current bg-current/10"
                        : "border-border/30 bg-muted/30 text-muted-foreground hover:border-border/60")}
                      style={active ? { borderColor: design.accentColor, color: design.accentColor, backgroundColor: design.accentColor + "18" } : {}}>
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className="text-[10px] mt-0.5 opacity-60 leading-tight">{t.desc}</div>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Perfis de design</p>

              {/* Named presets */}
              <div className="flex flex-wrap gap-1.5">
                {[...BUILTIN_PRESETS, ...namedPresets].map((p) => {
                  const isActive = design.accentColor === p.accentColor && design.bgColor === p.bgColor && design.profileName === p.profileName;
                  const isUserPreset = namedPresets.some((np) => np.presetName === p.presetName);
                  return (
                    <div key={p.presetName} className="flex items-center gap-0.5">
                      <button
                        onClick={() => { setDesign({ ...DEFAULT_DESIGN, ...p }); saveDesignAsDefault({ ...DEFAULT_DESIGN, ...p }); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border"
                        style={isActive
                          ? { background: p.accentColor, color: p.bgColor, borderColor: p.accentColor }
                          : { background: p.accentColor + "15", color: p.accentColor, borderColor: p.accentColor + "40" }}>
                        {p.profileImageUrl ? (
                          <img src={resolveImgUrl(p.profileImageUrl)} className="w-3.5 h-3.5 rounded-full object-cover" />
                        ) : (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.accentColor }} />
                        )}
                        {p.presetName}
                      </button>
                      {isUserPreset && (
                        <button onClick={() => {
                          removeNamedPreset(p.presetName);
                          setNamedPresets(loadNamedPresets());
                        }} className="text-muted-foreground/40 hover:text-destructive transition-colors text-[10px] px-0.5">×</button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Save as new preset */}
              <div className="flex gap-1.5">
                <input
                  className="flex-1 h-7 rounded-md border border-border/40 bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  placeholder="Nome do perfil..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newPresetName.trim()) {
                      const preset: NamedDesignPreset = { ...design, presetName: newPresetName.trim() };
                      persistNamedPreset(preset);
                      setNamedPresets(loadNamedPresets());
                      setNewPresetName("");
                      toast.success(`Perfil "${preset.presetName}" salvo!`);
                    }
                  }}
                />
                <Button size="sm" className="h-7 px-2.5 text-xs border-0 shrink-0"
                  style={{ background: design.accentColor, color: design.bgColor }}
                  disabled={!newPresetName.trim()}
                  onClick={() => {
                    const preset: NamedDesignPreset = { ...design, presetName: newPresetName.trim() };
                    persistNamedPreset(preset);
                    setNamedPresets(loadNamedPresets());
                    setNewPresetName("");
                    toast.success(`Perfil "${preset.presetName}" salvo!`);
                  }}>
                  Salvar
                </Button>
              </div>

              <div className="border-t border-border/20 pt-3 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Foto de perfil no slide</p>

                {/* Upload or URL */}
                <div className="flex gap-1.5">
                  <label
                    className="flex items-center justify-center gap-1 h-7 px-2.5 rounded-md border border-border/40 bg-background text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:border-border/70 transition-colors shrink-0"
                    title="Enviar foto do computador">
                    <ImageIcon className="w-3 h-3" />
                    Enviar
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        if (dataUrl) setDesign((d) => ({ ...d, profileImageUrl: dataUrl }));
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }} />
                  </label>
                  <input
                    className="flex-1 h-7 rounded-md border border-border/40 bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="ou cole a URL da foto..."
                    value={design.profileImageUrl?.startsWith("data:") ? "" : (design.profileImageUrl ?? "")}
                    onChange={(e) => setDesign((d) => ({ ...d, profileImageUrl: e.target.value || undefined }))}
                  />
                </div>

                {design.profileImageUrl && (
                  <div className="flex items-center gap-2">
                    <img src={design.profileImageUrl.startsWith("data:") ? design.profileImageUrl : resolveImgUrl(design.profileImageUrl)} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: design.accentColor }} />
                    <div>
                      <p className="text-[10px] text-foreground font-medium">{design.profileName || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{design.profileHandle || ""}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    className="flex-1 h-7 rounded-md border border-border/40 bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="Nome exibido..."
                    value={design.profileName ?? ""}
                    onChange={(e) => setDesign((d) => ({ ...d, profileName: e.target.value || undefined }))}
                  />
                  <input
                    className="flex-1 h-7 rounded-md border border-border/40 bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="@handle..."
                    value={design.profileHandle ?? ""}
                    onChange={(e) => setDesign((d) => ({ ...d, profileHandle: e.target.value || undefined }))}
                  />
                </div>
                {design.profileImageUrl && (
                  <button
                    onClick={() => setDesign((d) => ({ ...d, profileImageUrl: undefined, profileName: undefined, profileHandle: undefined }))}
                    className="w-full text-[10px] text-muted-foreground/60 hover:text-destructive border border-border/20 rounded-lg py-1 transition-colors">
                    Remover foto do slide
                  </button>
                )}
              </div>

              <div className="border-t border-border/20 pt-3 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cores & tipografia</p>

                {/* Accent color */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Cor de destaque</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ACCENT_PRESETS.map((p) => (
                      <ColorSwatch key={p.color} color={p.color} active={design.accentColor === p.color}
                        onClick={() => setDesign((d) => ({ ...d, accentColor: p.color }))} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={design.accentColor}
                      onChange={(e) => setDesign((d) => ({ ...d, accentColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-border/30 p-0.5 bg-transparent" />
                    <span className="text-xs text-muted-foreground font-mono">{design.accentColor}</span>
                  </div>
                </div>

                {/* Background color */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Cor de fundo</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {BG_PRESETS.map((p) => (
                      <ColorSwatch key={p.color} color={p.color} active={design.bgColor === p.color}
                        onClick={() => setDesign((d) => ({ ...d, bgColor: p.color }))} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={design.bgColor}
                      onChange={(e) => setDesign((d) => ({ ...d, bgColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-border/30 p-0.5 bg-transparent" />
                    <span className="text-xs text-muted-foreground font-mono">{design.bgColor}</span>
                  </div>
                </div>

                {/* Font */}
                <div className="grid grid-cols-2 gap-1.5">
                  {FONT_OPTIONS.map((f) => (
                    <button key={f.value} onClick={() => setDesign((d) => ({ ...d, fontFamily: f.value }))}
                      className={cn("px-2 py-1.5 rounded-lg text-xs border transition-all text-center",
                        design.fontFamily === f.value ? "border-cyan-500/50 bg-cyan-500/10 text-foreground" : "border-border/30 bg-muted/20 text-muted-foreground hover:text-foreground")}
                      style={{ fontFamily: f.value }}>{f.label}</button>
                  ))}
                </div>

                {/* Alignment */}
                <div className="flex gap-2">
                  <button onClick={() => setDesign((d) => ({ ...d, titleAlign: "left" }))}
                    className={cn("flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs border transition-all",
                      design.titleAlign === "left" ? "border-cyan-500/50 bg-cyan-500/10" : "border-border/30 bg-muted/20 text-muted-foreground")}>
                    <AlignLeft className="w-3 h-3" /> Esq
                  </button>
                  <button onClick={() => setDesign((d) => ({ ...d, titleAlign: "center" }))}
                    className={cn("flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs border transition-all",
                      design.titleAlign === "center" ? "border-cyan-500/50 bg-cyan-500/10" : "border-border/30 bg-muted/20 text-muted-foreground")}>
                    <AlignCenter className="w-3 h-3" /> Centro
                  </button>
                </div>

                {/* Font size */}
                <div>
                  <input type="range" min={0.7} max={1.4} step={0.05} value={design.titleSize}
                    onChange={(e) => setDesign((d) => ({ ...d, titleSize: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: design.accentColor }} />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Menor</span><span>Maior</span></div>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => { saveDesignAsDefault(design); toast.success("Design salvo como padrão!"); }}
                    className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors border"
                    style={{ background: design.accentColor + "18", color: design.accentColor, borderColor: design.accentColor + "40" }}>
                    Salvar como padrão
                  </button>
                  <button
                    onClick={() => { setDesign(DEFAULT_DESIGN); saveDesignAsDefault(DEFAULT_DESIGN); toast.success("Design resetado."); }}
                    className="flex-1 text-[10px] text-muted-foreground hover:text-foreground border border-border/30 rounded-lg py-1.5 transition-colors">
                    Resetar
                  </button>
                </div>
              </div>
            </div>

            {/* Imagem */}
            <div className="p-4 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Imagem do slide {activeIdx + 1}</p>
              {activeSlide.imageUrl && activeSlide.slideType !== "cta" && (
                <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "4/5" }}>
                  <img src={resolveImgUrl(activeSlide.imageUrl)} className="w-full h-full object-cover" />
                </div>
              )}
              {/* Hidden file input for local upload */}
              <input
                ref={slideImgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = "";
                  setIsUploadingSlideImg(true);
                  try {
                    const res = await fetch("/api/upload-media", {
                      method: "POST",
                      headers: { "Content-Type": file.type },
                      body: file,
                      credentials: "include",
                    });
                    if (!res.ok) throw new Error(await res.text());
                    const { url } = await res.json() as { url: string };
                    setResult((prev) => {
                      if (!prev) return prev;
                      const sl = [...prev.slides];
                      sl[activeIdx] = { ...sl[activeIdx], imageUrl: url };
                      return { ...prev, slides: sl };
                    });
                    toast.success("Imagem carregada!");
                  } catch (err) {
                    toast.error("Erro ao enviar imagem: " + (err instanceof Error ? err.message : "falha"));
                  } finally {
                    setIsUploadingSlideImg(false);
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                  disabled={isUploadingSlideImg}
                  onClick={() => slideImgInputRef.current?.click()}>
                  {isUploadingSlideImg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Do computador
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                  disabled={regenImageMutation.isPending}
                  onClick={() => regenImageMutation.mutate({
                    carouselId: result.id, slideIndex: activeIdx, topic: result.topic, hook: result.hook,
                    slideTitle: activeSlide.title, slideBody: activeSlide.body ?? "",
                    currentSlides: result.slides.map((s) => ({ title: s.title, body: s.body ?? "", imageUrl: s.imageUrl, slideType: s.slideType, shortText: s.shortText, imagePrompt: s.imagePrompt, highlightWords: s.highlightWords, wordStyles: s.wordStyles })),
                    imagePrompt: activeSlide.imagePrompt,
                  })}>
                  {regenImageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Gerar com IA
                </Button>
              </div>
            </div>

            {/* Canva */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Canva</p>
                {canvaConnection && (
                  <button className="text-[10px] text-muted-foreground hover:text-destructive underline"
                    onClick={() => canvaDisconnectMutation.mutate()}>Desconectar</button>
                )}
              </div>
              {!canvaConnection ? (
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8"
                  onClick={() => { window.location.href = "/api/oauth/canva/authorize"; }}>
                  <Link2 className="w-3.5 h-3.5" /> Conectar conta Canva
                </Button>
              ) : (
                <div className="space-y-2">
                  {canvaConnection.displayName && (
                    <p className="text-[10px] text-muted-foreground">Conectado como <span className="font-medium text-foreground/80">{canvaConnection.displayName}</span></p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="outline" size="sm" className="gap-1 text-xs h-7" disabled={canvaCreateMutation.isPending}
                      onClick={() => canvaCreateMutation.mutate({ width: 1080, height: 1350, title: result?.topic })}>
                      {canvaCreateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Novo
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-xs h-7" disabled={!activeSlide.canvaDesignId}
                      onClick={() => activeSlide.canvaDesignId && openCanvaDesignInTab(activeSlide.canvaDesignId)}>
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <input className="flex-1 h-7 rounded-md border border-border/40 bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                      placeholder="Buscar designs..." value={canvaSearchInput}
                      onChange={(e) => setCanvaSearchInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { setCanvaSearch(canvaSearchInput); void refetchCanvaDesigns(); } }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => { setCanvaSearch(canvaSearchInput); void refetchCanvaDesigns(); }}>
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                  {isLoadingCanvaDesigns && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
                  {!isLoadingCanvaDesigns && canvaDesigns && (
                    <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
                      {canvaDesigns.designs.length === 0 && <p className="col-span-2 text-center text-xs text-muted-foreground py-3">Nenhum design.</p>}
                      {canvaDesigns.designs.map((d) => (
                        <button key={d.id} disabled={canvaExportingId === d.id}
                          className="relative rounded-lg overflow-hidden border border-border/30 bg-muted/20 hover:border-primary/50 transition-colors text-left disabled:opacity-60"
                          onClick={async () => {
                            if (!result) return; setCanvaExportingId(d.id);
                            try {
                              const { urls } = await canvaExportMutation.mutateAsync({ designId: d.id, format: "jpg" });
                              if (urls[0]) { setResult((prev) => { if (!prev) return prev; const sl = [...prev.slides]; sl[activeIdx] = { ...sl[activeIdx], imageUrl: urls[0], canvaDesignId: d.id }; return { ...prev, slides: sl }; }); toast.success("Design importado!"); }
                            } finally { setCanvaExportingId(null); }
                          }}>
                          <div style={{ aspectRatio: "1/1" }} className="bg-muted/30">
                            {d.thumbnailUrl ? <img src={d.thumbnailUrl} alt={d.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-muted-foreground/30" /></div>}
                          </div>
                          <div className="p-1"><p className="text-[10px] text-foreground/80 truncate">{d.title}</p></div>
                          {canvaExportingId === d.id && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── SLIDES GRID ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-muted/5">
          <div className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <h2 className="text-sm font-semibold truncate max-w-sm">{result.topic}</h2>
              <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full shrink-0">{result.slides.length} slides</span>
              <span className="text-[11px] text-muted-foreground shrink-0">· clique para editar</span>
            </div>
            <div className="flex flex-wrap gap-5">
              {result.slides.map((slide, i) => (
                <SlideGridItem
                  key={i} slide={slide} index={i} total={result.slides.length}
                  design={design} active={activeIdx === i} accentColor={design.accentColor}
                  onClick={() => setActiveIdx(i)}
                  onUpdate={(field, value) => setResult((prev) => {
                    if (!prev) return prev;
                    const sl = [...prev.slides];
                    sl[i] = { ...sl[i], [field]: value };
                    return { ...prev, slides: sl };
                  })}
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
