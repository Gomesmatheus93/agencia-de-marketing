import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowDownToLine, ArrowUpToLine, Circle, Copy, ImagePlus, Loader2, Minus, Paintbrush, Plus, Redo2, Square, Trash2, Type, Undo2, X, Zap,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

// Editor visual das artes feitas pelos agentes. A arte é um SVG: o editor mostra
// esse SVG na tela e mexe nele direto (mover, redimensionar, cores, textos,
// imagens, camadas). Ao salvar, o servidor renderiza o PNG com o mesmo motor
// que os agentes usam, então o resultado bate com o que se vê aqui.

export type ArtTarget = { kind: "slide" | "frame" | "post"; index?: number };

const SVG_NS = "http://www.w3.org/2000/svg";
const ASSETS = "/api/design-assets/assets";
const BRAND_IMAGES = [
  { href: "alle:logo", label: "Logo (fundo claro)", w: 1200, h: 353 },
  { href: "alle:logo-branco", label: "Logo branco (raio laranja)", w: 1200, h: 353 },
  { href: "alle:logo-mono", label: "Logo todo branco (fundo laranja)", w: 1200, h: 353 },
  { href: "alle:allpfit-mono", label: "Logo Allp Fit todo branco", w: 1271, h: 275 },
  { href: "alle:allpfit-branco", label: "Logo Allp Fit (fundo escuro)", w: 1271, h: 275 },
  { href: "alle:allpfit", label: "Logo Allp Fit colorido (fundo claro)", w: 1271, h: 275 },
  { href: "alle:allpfit-roxo", label: "Logo Allp Fit roxa (oficial)", w: 1271, h: 275 },
  { href: "alle:raio", label: "Raio colorido", w: 376, h: 600 },
  { href: "alle:raio-branco", label: "Raio branco e laranja", w: 376, h: 600 },
  { href: "alle:raio-mono", label: "Raio todo branco", w: 376, h: 600 },
  { href: "alle:ane", label: "Ane · braços cruzados", w: 848, h: 997 },
  { href: "alle:ane-solto", label: "Ane · cabelo solto", w: 880, h: 994 },
  { href: "alle:ane-caneca", label: "Ane · com a caneca da Alle", w: 1016, h: 1020 },
  { href: "alle:ane-ombro", label: "Ane · olhando por cima do ombro", w: 742, h: 1020 },
];
const PALETTE = ["#7B2FBE", "#7c00ae", "#ff7300", "#F47B20", "#1E0A01", "#FFFFFF", "#FFF8F2", "#6A24A8"];
const WEIGHTS = [["300", "Fina"], ["400", "Normal"], ["500", "Média"], ["600", "Semi"], ["700", "Negrito"], ["800", "Extra"], ["900", "Black"]] as const;
const FONT_FACES = [["Light", 300], ["Regular", 400], ["Medium", 500], ["SemiBold", 600], ["Bold", 700], ["ExtraBold", 800], ["Black", 900]]
  .map(([n, w]) => `@font-face{font-family:"Montserrat";font-weight:${w};src:url("/api/design-assets/fonts/Montserrat-${n}.otf") format("opentype");}`)
  .join("");

const SELECTABLE = new Set(["rect", "circle", "ellipse", "path", "polygon", "polyline", "line", "image", "text"]);
const COLOR_ATTRS = ["fill", "stroke"] as const;

// ─── Botão que abre o editor ──────────────────────────────────────────────────

export function ArtEditButton({ threadId, target, onSaved, className }: { threadId: number; target: ArtTarget; onSaved: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className={className ?? "gap-1.5"} onClick={() => setOpen(true)}><Paintbrush className="h-3.5 w-3.5" />Editar arte</Button>
      {open && createPortal(<ArtStudio threadId={threadId} target={target} onClose={() => setOpen(false)} onSaved={onSaved} />, document.body)}
    </>
  );
}

// ─── Utilidades de SVG ────────────────────────────────────────────────────────

const num = (v: string | null | undefined, d = 0) => (v == null || v === "" || Number.isNaN(Number(v)) ? d : Number(v));

function toHex(color: string | null): string {
  if (!color) return "#000000";
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color.slice(1).split("").map((c) => c + c).join("")}`.toLowerCase();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return "#000000";
  ctx.fillStyle = color;
  return ctx.fillStyle.startsWith("#") ? ctx.fillStyle : "#000000";
}

function hrefOf(el: Element) {
  return el.getAttribute("href") ?? el.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? "";
}

/** Mostra a imagem no navegador; o endereço original (alle:…) fica em data-src para salvar. */
function setImageHref(el: Element, href: string) {
  el.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
  el.setAttribute("data-src", href);
  el.setAttribute("href", href.startsWith("alle:") ? `${ASSETS}/${href.slice(5)}.png` : href);
}

/** Aplica uma transformação (no espaço do pai) antes da que o elemento já tem, e simplifica para uma matriz. */
function prependTransform(el: SVGGraphicsElement, m: DOMMatrix) {
  const current = el.transform.baseVal.consolidate()?.matrix;
  const n = current ? m.multiply(DOMMatrix.fromMatrix(current)) : m;
  const r = (v: number) => Math.round(v * 10000) / 10000;
  el.setAttribute("transform", `matrix(${r(n.a)} ${r(n.b)} ${r(n.c)} ${r(n.d)} ${r(n.e)} ${r(n.f)})`);
}

/**
 * Limpa o SVG antes de ir para a página: o desenho vem do banco (feito por um
 * agente que lê conteúdo público, ou salvo pela equipe), então nada de script,
 * atributos on… nem links que não sejam imagem.
 */
function sanitize(root: Element) {
  root.querySelectorAll("script, foreignObject, iframe, object, embed, animate, set").forEach((n) => n.remove());
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) { el.removeAttribute(attr.name); continue; }
      if (name === "href" || name === "xlink:href" || name === "data-src") {
        const v = attr.value.trim();
        const ok = /^(https:\/\/|data:image\/(png|jpeg|webp|gif);|alle:[a-z-]+$|#)/i.test(v) || v.startsWith(`${ASSETS}/`);
        if (!ok) el.removeAttribute(attr.name);
      }
    }
  }
}

function isBackground(el: Element, w: number, h: number) {
  return el.tagName === "rect" && num(el.getAttribute("x")) === 0 && num(el.getAttribute("y")) === 0
    && num(el.getAttribute("width")) >= w && num(el.getAttribute("height")) >= h;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function ArtStudio({ threadId, target, onClose, onSaved }: { threadId: number; target: ArtTarget; onClose: () => void; onSaved: () => void }) {
  const utils = trpc.useUtils();
  const query = { threadId, target: { kind: target.kind, index: target.index ?? 0 } };
  const source = trpc.agents.artSource.useQuery(query, { refetchOnWindowFocus: false });
  const save = trpc.agents.saveArt.useMutation();
  const undoSaved = trpc.agents.undoArtEdit.useMutation();

  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const size = useRef({ w: 1080, h: 1350 });
  const nextId = useRef(1);
  const history = useRef<{ stack: string[]; pos: number }>({ stack: [], pos: -1 });
  const drag = useRef<{ el: SVGGraphicsElement; x: number; y: number; base: string | null; moved: boolean } | null>(null);
  const [selected, setSelected] = useState<SVGGraphicsElement | null>(null);
  const [version, setVersion] = useState(0);
  // Só muda quando o desenho é trocado por fora (desfazer/refazer, abrir a arte):
  // aí o painel remonta para mostrar os valores novos. Digitar não remonta.
  const [rev, setRev] = useState(0);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const bump = () => setVersion((v) => v + 1);

  const tag = (el: Element) => { if (!el.getAttribute("data-eid")) el.setAttribute("data-eid", String(nextId.current++)); };

  const snapshot = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const h = history.current;
    h.stack = h.stack.slice(0, h.pos + 1);
    h.stack.push(svg.innerHTML);
    if (h.stack.length > 120) h.stack.shift();
    h.pos = h.stack.length - 1;
    setDirty(h.pos > 0);
  }, []);

  /** Grava o estado depois de uma alteração. */
  const commit = useCallback(() => { snapshot(); bump(); }, [snapshot]);

  const restore = (pos: number) => {
    const svg = svgRef.current;
    const h = history.current;
    if (!svg || pos < 0 || pos >= h.stack.length) return;
    const eid = selected?.getAttribute("data-eid");
    svg.innerHTML = h.stack[pos];
    sanitize(svg);
    h.pos = pos;
    setSelected(eid ? (svg.querySelector(`[data-eid="${eid}"]`) as SVGGraphicsElement | null) : null);
    setDirty(pos > 0);
    setRev((r) => r + 1);
    bump();
  };

  // Monta o SVG na tela a partir do desenho guardado.
  useEffect(() => {
    const host = hostRef.current;
    const raw = source.data?.svg;
    if (!host || !raw) return;
    const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
    const root = doc.documentElement;
    if (root.tagName !== "svg" || doc.querySelector("parsererror")) { setError("Não consegui ler o desenho desta arte."); return; }
    sanitize(root);
    const svg = document.importNode(root, true) as unknown as SVGSVGElement;
    const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    size.current = { w: vb[2] || num(svg.getAttribute("width"), 1080), h: vb[3] || num(svg.getAttribute("height"), 1350) };
    svg.setAttribute("style", "width:100%;height:auto;display:block;user-select:none");
    svg.querySelectorAll("*").forEach(tag);
    svg.querySelectorAll("image").forEach((im) => setImageHref(im, hrefOf(im)));
    host.replaceChildren(svg);
    svgRef.current = svg;
    history.current = { stack: [svg.innerHTML], pos: 0 };
    setSelected(null);
    setDirty(false);
    bump();
  }, [source.data?.svg]);

  // Caixa de seleção por cima do elemento escolhido.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!selected || !host || !selected.isConnected) { setBox(null); return; }
    const a = selected.getBoundingClientRect();
    const b = host.getBoundingClientRect();
    setBox({ left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height });
  }, [selected, version]);

  useEffect(() => {
    const onResize = () => bump();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const scale = () => {
    const svg = svgRef.current;
    return svg ? size.current.w / svg.getBoundingClientRect().width : 1;
  };

  /**
   * O que um clique seleciona. Um clique pega o grupo inteiro (ícone, cartão com
   * texto, selo); `deep` (dois cliques ou Alt/Ctrl) pega só a peça clicada.
   */
  const pickTarget = (t: EventTarget | null, deep: boolean): SVGGraphicsElement | null => {
    const svg = svgRef.current;
    let el = t instanceof Element ? t : null;
    if (el?.tagName === "tspan") el = el.closest("text");
    if (!svg || !el || el === svg || !svg.contains(el)) {
      const bg = svg ? Array.from(svg.children).find((c) => isBackground(c, size.current.w, size.current.h)) : null;
      return (bg as SVGGraphicsElement | undefined) ?? null;
    }
    while (el && el !== svg && !SELECTABLE.has(el.tagName)) el = el.parentElement;
    if (!el || el === svg) return null;
    if (deep) return el as SVGGraphicsElement;
    // Clicar de novo na peça (ou no grupo) já selecionada mantém a seleção, para poder arrastar.
    if (selected && (selected === el || selected.contains(el))) return selected;
    let top: Element = el;
    while (top.parentNode && top.parentNode !== svg && top.parentNode instanceof Element) top = top.parentNode;
    return (top.tagName === "g" ? top : el) as SVGGraphicsElement;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const el = pickTarget(document.elementFromPoint(e.clientX, e.clientY), true);
    if (el) setSelected(el);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = pickTarget(e.target, e.altKey || e.ctrlKey || e.metaKey);
    setSelected(el);
    if (!el || isBackground(el, size.current.w, size.current.h)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { el, x: e.clientX, y: e.clientY, base: el.getAttribute("transform"), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || !svg) return;
    const k = scale();
    const dx = (e.clientX - d.x) * k;
    const dy = (e.clientY - d.y) * k;
    if (!d.moved && Math.hypot(dx, dy) < 2) return;
    d.moved = true;
    if (d.base) d.el.setAttribute("transform", d.base); else d.el.removeAttribute("transform");
    prependTransform(d.el, new DOMMatrix().translate(dx, dy));
    bump();
  };
  const onPointerUp = () => {
    if (drag.current?.moved) commit();
    drag.current = null;
  };

  // ── Ações ──
  const move = (dx: number, dy: number) => {
    const svg = svgRef.current;
    if (!selected || !svg || isBackground(selected, size.current.w, size.current.h)) return;
    prependTransform(selected, new DOMMatrix().translate(dx, dy));
    commit();
  };
  const resize = (factor: number) => {
    const svg = svgRef.current;
    if (!selected || !svg) return;
    const b = selected.getBBox();
    const m = selected.transform.baseVal.consolidate()?.matrix;
    const c = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(m ? DOMMatrix.fromMatrix(m) : new DOMMatrix());
    prependTransform(selected, new DOMMatrix().translate(c.x, c.y).scale(factor).translate(-c.x, -c.y));
    commit();
  };
  const remove = () => {
    if (!selected || isBackground(selected, size.current.w, size.current.h)) return;
    selected.remove();
    setSelected(null);
    commit();
  };
  const duplicate = () => {
    const svg = svgRef.current;
    if (!selected || !svg || isBackground(selected, size.current.w, size.current.h)) return;
    const clone = selected.cloneNode(true) as SVGGraphicsElement;
    clone.removeAttribute("data-eid");
    clone.querySelectorAll("[data-eid]").forEach((n) => n.removeAttribute("data-eid"));
    tag(clone);
    clone.querySelectorAll("*").forEach(tag);
    selected.after(clone);
    prependTransform(clone, new DOMMatrix().translate(30, 30));
    setSelected(clone);
    commit();
  };
  const toFront = () => { if (!selected) return; selected.parentNode?.appendChild(selected); commit(); };
  const toBack = () => {
    const svg = svgRef.current;
    if (!selected || !svg || isBackground(selected, size.current.w, size.current.h)) return;
    const parent = selected.parentNode as Element;
    const first = Array.from(parent.children).find((c) => c !== selected && !isBackground(c, size.current.w, size.current.h) && c.tagName !== "defs" && c.tagName !== "style");
    if (first) parent.insertBefore(selected, first);
    commit();
  };
  const setAttr = (el: Element, name: string, value: string | null, record = true) => {
    if (value === null || value === "") el.removeAttribute(name); else el.setAttribute(name, value);
    if (record) commit(); else bump();
  };

  const add = (kind: "text" | "rect" | "circle" | "brand", href?: string) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { w, h } = size.current;
    let el: SVGGraphicsElement;
    if (kind === "text") {
      el = document.createElementNS(SVG_NS, "text") as SVGGraphicsElement;
      el.setAttribute("font-family", "Montserrat");
      el.setAttribute("font-size", "64");
      el.setAttribute("font-weight", "800");
      el.setAttribute("fill", "#1E0A01");
      const t = document.createElementNS(SVG_NS, "tspan");
      t.setAttribute("x", "80");
      t.setAttribute("y", String(Math.round(h / 2)));
      t.textContent = "Novo texto";
      el.appendChild(t);
    } else if (kind === "rect") {
      el = document.createElementNS(SVG_NS, "rect") as SVGGraphicsElement;
      Object.entries({ x: w / 2 - 200, y: h / 2 - 60, width: 400, height: 120, rx: 24, fill: "#ff7300" }).forEach(([k, v]) => el.setAttribute(k, String(v)));
    } else if (kind === "circle") {
      el = document.createElementNS(SVG_NS, "circle") as SVGGraphicsElement;
      Object.entries({ cx: w / 2, cy: h / 2, r: 120, fill: "#7c00ae" }).forEach(([k, v]) => el.setAttribute(k, String(v)));
    } else {
      const asset = BRAND_IMAGES.find((b) => b.href === href) ?? BRAND_IMAGES[1];
      el = document.createElementNS(SVG_NS, "image") as SVGGraphicsElement;
      if (asset.href.startsWith("alle:ane")) {
        // A Ane entra encostada no pé da arte, no canto direito (regra da alle-design).
        const height = Math.round(h * 0.53), width = Math.round((height * asset.w) / asset.h);
        Object.entries({ x: w - width, y: h - height, width, height }).forEach(([k, v]) => el.setAttribute(k, String(v)));
      } else {
        const width = asset.w > asset.h ? 340 : 200;
        Object.entries({ x: 80, y: 80, width, height: Math.round((width * asset.h) / asset.w) }).forEach(([k, v]) => el.setAttribute(k, String(v)));
      }
      setImageHref(el, asset.href);
    }
    tag(el);
    el.querySelectorAll("*").forEach(tag);
    svg.appendChild(el);
    setSelected(el);
    commit();
  };

  const uploadImage = async (file: File, replace?: Element) => {
    const svg = svgRef.current;
    if (!svg) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast.error("Use uma imagem PNG, JPG ou WEBP."); return; }
    const res = await fetch("/api/upload-media", { method: "POST", headers: { "Content-Type": file.type }, body: file, credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !json.url) { toast.error(json.error ?? "Falha ao enviar a imagem."); return; }
    const url = json.url;
    const dims = await new Promise<{ w: number; h: number }>((ok) => {
      const img = new Image();
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => ok({ w: 1, h: 1 });
      img.src = URL.createObjectURL(file);
    });
    if (replace) {
      setImageHref(replace, url);
      replace.setAttribute("preserveAspectRatio", replace.getAttribute("preserveAspectRatio") ?? "xMidYMid slice");
      commit();
      return;
    }
    const width = Math.min(600, size.current.w - 160);
    const el = document.createElementNS(SVG_NS, "image") as SVGGraphicsElement;
    Object.entries({ x: 80, y: 200, width, height: Math.round((width * dims.h) / dims.w), preserveAspectRatio: "xMidYMid meet" }).forEach(([k, v]) => el.setAttribute(k, String(v)));
    setImageHref(el, url);
    tag(el);
    svg.appendChild(el);
    setSelected(el);
    commit();
  };

  // Atalhos de teclado (fora dos campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (typing) return;
        e.preventDefault();
        restore(history.current.pos + (e.shiftKey ? 1 : -1));
        return;
      }
      if (typing || !selected) return;
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) { e.preventDefault(); move(...moves[e.key]); }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); }
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const serialize = () => {
    const svg = svgRef.current;
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute("style");
    clone.querySelectorAll("[data-src]").forEach((im) => { im.setAttribute("href", im.getAttribute("data-src")!); im.removeAttribute("data-src"); });
    clone.querySelectorAll("[data-eid]").forEach((n) => n.removeAttribute("data-eid"));
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", SVG_NS);
    return new XMLSerializer().serializeToString(clone);
  };

  const finish = (message: string) => {
    toast.success(message);
    utils.agents.artSource.invalidate(query);
    onSaved();
    onClose();
  };
  const onSave = () => {
    const svg = serialize();
    if (!svg) return;
    save.mutate({ ...query, svg }, { onSuccess: () => finish("Arte salva"), onError: (e) => toast.error(e.message) });
  };
  const close = () => {
    if (dirty && !window.confirm("Sair sem salvar as alterações?")) return;
    onClose();
  };

  const bgEl = svgRef.current ? (Array.from(svgRef.current.children).find((c) => isBackground(c, size.current.w, size.current.h)) as SVGGraphicsElement | undefined) : undefined;
  const h = history.current;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <style>{FONT_FACES}</style>
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <p className="mr-2 font-semibold">Editar arte</p>
        <Button variant="ghost" size="sm" disabled={h.pos <= 0} onClick={() => restore(h.pos - 1)} title="Desfazer (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" disabled={h.pos >= h.stack.length - 1} onClick={() => restore(h.pos + 1)} title="Refazer (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => add("text")}><Type className="h-3.5 w-3.5" />Texto</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => add("rect")}><Square className="h-3.5 w-3.5" />Retângulo</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => add("circle")}><Circle className="h-3.5 w-3.5" />Círculo</Button>
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value="" onChange={(e) => { if (e.target.value) add("brand", e.target.value); }}>
          <option value="">+ Logo / raio / Ane</option>
          {BRAND_IMAGES.map((b) => <option key={b.href} value={b.href}>{b.label}</option>)}
        </select>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent">
          <ImagePlus className="h-3.5 w-3.5" />Imagem
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadImage(f); }} />
        </label>
        <div className="ml-auto flex items-center gap-2">
          {source.data?.canUndo && !dirty && (
            <Button variant="ghost" size="sm" className="gap-1.5" disabled={undoSaved.isPending} onClick={() => undoSaved.mutate(query, { onSuccess: () => finish("Voltou para a versão anterior"), onError: (e) => toast.error(e.message) })}>
              <Undo2 className="h-3.5 w-3.5" />Voltar à versão salva anterior
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={close} disabled={save.isPending}><X className="mr-1 h-3.5 w-3.5" />Cancelar</Button>
          <Button size="sm" onClick={onSave} disabled={save.isPending || !dirty}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar arte</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/40 p-4">
          {source.isLoading ? (
            <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Abrindo a arte…</p>
          ) : !source.data?.svg || error ? (
            <p className="max-w-md rounded-lg bg-background p-4 text-sm text-muted-foreground">{error ?? "Esta arte foi feita antes da edição existir e o desenho dela não ficou guardado. Peça o ajuste ao agente ou gere de novo."}</p>
          ) : null}
          <div
            className={cn("relative touch-none shadow-lg", (!source.data?.svg || error) && "hidden")}
            style={{ width: `min(100%, calc((100vh - 140px) * ${size.current.w / size.current.h}))` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onDoubleClick}
          >
            <div ref={hostRef} className="cursor-default" />
            {box && (
              <div className="pointer-events-none absolute border-2 border-sky-500" style={{ left: box.left - 3, top: box.top - 3, width: box.width + 6, height: box.height + 6 }} />
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 overflow-y-auto border-t p-4 lg:w-80 lg:border-l lg:border-t-0">
          {selected ? (
            <Inspector
              key={`${selected.getAttribute("data-eid")}-${rev}`}
              el={selected}
              isBg={isBackground(selected, size.current.w, size.current.h)}
              setAttr={setAttr}
              commit={commit}
              bump={bump}
              tag={tag}
              actions={{ move, resize, remove, duplicate, toFront, toBack }}
              onReplaceImage={(f) => uploadImage(f, selected)}
            />
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">Clique em qualquer elemento da arte para editar. Arraste para mover; use as setas do teclado para ajustes finos (Shift = 10 px).</p>
              {bgEl && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Cor do fundo</p>
                  <ColorField value={bgEl.getAttribute("fill")} onChange={(v) => setAttr(bgEl, "fill", v)} />
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Painel de propriedades ───────────────────────────────────────────────────

type Actions = { move: (dx: number, dy: number) => void; resize: (f: number) => void; remove: () => void; duplicate: () => void; toFront: () => void; toBack: () => void };

function ColorField({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const hex = toHex(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border bg-transparent" />
        <Input defaultValue={hex} key={hex} onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && onChange(e.target.value)} className="h-8 font-mono text-xs" />
      </div>
      <div className="flex flex-wrap gap-1">
        {PALETTE.map((c) => <button key={c} title={c} onClick={() => onChange(c)} className="h-5 w-5 rounded border" style={{ background: c }} />)}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-muted-foreground">{label}
      <Input type="number" step={step} defaultValue={Math.round(value * 100) / 100} onBlur={(e) => e.target.value !== "" && onChange(Number(e.target.value))} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className="h-8 text-sm text-foreground" />
    </label>
  );
}

function Inspector({ el, isBg, setAttr, commit, bump, tag, actions, onReplaceImage }: {
  el: SVGGraphicsElement; isBg: boolean;
  setAttr: (el: Element, name: string, value: string | null, record?: boolean) => void;
  commit: () => void; bump: () => void; tag: (el: Element) => void; actions: Actions; onReplaceImage: (f: File) => void;
}) {
  const kind = el.tagName;
  const label = isBg ? "Fundo" : ({ g: "Grupo", text: "Texto", rect: "Retângulo", circle: "Círculo", ellipse: "Elipse", image: "Imagem", path: "Forma", polygon: "Forma", polyline: "Linha", line: "Linha" } as Record<string, string>)[kind] ?? kind;
  const opacity = num(el.getAttribute("opacity"), 1);
  const hasFill = kind !== "image" && kind !== "line" && kind !== "g" && el.getAttribute("fill") !== "none";
  const hasStroke = !!el.getAttribute("stroke") && el.getAttribute("stroke") !== "none";

  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{label}</p>
        {!isBg && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar" onClick={actions.duplicate}><Copy className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Trazer para frente" onClick={actions.toFront}><ArrowUpToLine className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Mandar para trás" onClick={actions.toBack}><ArrowDownToLine className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Apagar (Delete)" onClick={actions.remove}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      {kind === "text" && <TextPanel el={el} setAttr={setAttr} commit={commit} bump={bump} tag={tag} />}
      {kind === "g" && <GroupColors el={el} commit={commit} />}

      {!isBg && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Tamanho</p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => actions.resize(1 / 1.1)}><Minus className="h-3.5 w-3.5" />Diminuir</Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => actions.resize(1.1)}><Plus className="h-3.5 w-3.5" />Aumentar</Button>
          </div>
        </div>
      )}

      {kind === "rect" && !isBg && (
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Largura" value={num(el.getAttribute("width"))} onChange={(v) => setAttr(el, "width", String(v))} />
          <NumberField label="Altura" value={num(el.getAttribute("height"))} onChange={(v) => setAttr(el, "height", String(v))} />
          <NumberField label="Cantos" value={num(el.getAttribute("rx"))} onChange={(v) => setAttr(el, "rx", String(v))} />
        </div>
      )}
      {kind === "circle" && <NumberField label="Raio" value={num(el.getAttribute("r"))} onChange={(v) => setAttr(el, "r", String(v))} />}
      {kind === "image" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Largura" value={num(el.getAttribute("width"))} onChange={(v) => setAttr(el, "width", String(v))} />
            <NumberField label="Altura" value={num(el.getAttribute("height"))} onChange={(v) => setAttr(el, "height", String(v))} />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Trocar imagem</p>
          <select className="h-8 w-full rounded-md border bg-background px-2 text-sm" value="" onChange={(e) => { if (e.target.value) { setImageHref(el, e.target.value); commit(); } }}>
            <option value="">Arquivo da marca…</option>
            {BRAND_IMAGES.map((b) => <option key={b.href} value={b.href}>{b.label}</option>)}
          </select>
          <label className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border text-sm hover:bg-accent">
            <ImagePlus className="h-3.5 w-3.5" />Enviar outra imagem
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onReplaceImage(f); }} />
          </label>
        </div>
      )}

      {hasFill && kind !== "text" && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Cor</p>
          <ColorField value={el.getAttribute("fill") ?? "#000000"} onChange={(v) => setAttr(el, "fill", v)} />
        </div>
      )}
      {hasStroke && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Cor do contorno</p>
          <ColorField value={el.getAttribute("stroke")} onChange={(v) => setAttr(el, "stroke", v)} />
          <NumberField label="Espessura do contorno" value={num(el.getAttribute("stroke-width"), 1)} onChange={(v) => setAttr(el, "stroke-width", String(v))} />
        </div>
      )}

      <label className="block space-y-1 text-xs font-medium text-muted-foreground">Opacidade: {Math.round(opacity * 100)}%
        <input type="range" min={0} max={100} defaultValue={Math.round(opacity * 100)} className="w-full"
          onChange={(e) => setAttr(el, "opacity", Number(e.target.value) >= 100 ? null : String(Number(e.target.value) / 100), false)}
          onPointerUp={() => commit()} />
      </label>

      {!isBg && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Mover</p>
          <div className="grid w-32 grid-cols-3 gap-1">
            <span /><Button variant="outline" size="sm" onClick={() => actions.move(0, -10)}>↑</Button><span />
            <Button variant="outline" size="sm" onClick={() => actions.move(-10, 0)}>←</Button><span />
            <Button variant="outline" size="sm" onClick={() => actions.move(10, 0)}>→</Button>
            <span /><Button variant="outline" size="sm" onClick={() => actions.move(0, 10)}>↓</Button><span />
          </div>
        </div>
      )}
    </div>
  );
}

/** Cores usadas dentro de um grupo: trocar uma cor troca em todas as peças que a usam. */
function GroupColors({ el, commit }: { el: SVGGraphicsElement; commit: () => void }) {
  const nodes = [el, ...Array.from(el.querySelectorAll("*"))];
  const colors = [...new Set(nodes.flatMap((n) => COLOR_ATTRS.map((a) => n.getAttribute(a)).filter((c): c is string => !!c && c !== "none" && !c.startsWith("url(")).map(toHex)))];
  const recolor = (from: string, to: string) => {
    for (const n of nodes) for (const a of COLOR_ATTRS) { const c = n.getAttribute(a); if (c && c !== "none" && !c.startsWith("url(") && toHex(c) === from) n.setAttribute(a, to); }
    commit();
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Dê dois cliques numa parte do grupo para editar só ela.</p>
      {colors.length > 0 && <p className="text-xs font-medium text-muted-foreground">Cores do grupo</p>}
      {colors.map((c) => <ColorField key={c} value={c} onChange={(v) => recolor(c, toHex(v))} />)}
    </div>
  );
}

function TextPanel({ el, setAttr, commit, bump, tag }: {
  el: SVGGraphicsElement; setAttr: (el: Element, name: string, value: string | null, record?: boolean) => void; commit: () => void; bump: () => void; tag: (el: Element) => void;
}) {
  const runs = Array.from(el.children).filter((c) => c.tagName === "tspan");
  const first = runs[0] ?? el;
  const fontSize = num(el.getAttribute("font-size") ?? first.getAttribute("font-size"), 40);
  const weight = el.getAttribute("font-weight") ?? first.getAttribute("font-weight") ?? "400";
  const anchor = el.getAttribute("text-anchor") ?? "start";

  // Tamanho e peso valem para o texto todo: tira o que estiver só em uma linha.
  const setForAll = (name: string, value: string) => {
    runs.forEach((r) => r.removeAttribute(name));
    setAttr(el, name, value);
  };
  const addLine = () => {
    const last = runs[runs.length - 1];
    const t = document.createElementNS(SVG_NS, "tspan");
    t.setAttribute("x", last?.getAttribute("x") ?? el.getAttribute("x") ?? "80");
    t.setAttribute("dy", String(Math.round(fontSize * 1.2)));
    t.textContent = "Nova linha";
    tag(t);
    if (!runs.length) {
      const head = document.createElementNS(SVG_NS, "tspan");
      head.setAttribute("x", el.getAttribute("x") ?? "80");
      head.setAttribute("y", el.getAttribute("y") ?? "0");
      head.textContent = el.textContent ?? "";
      tag(head);
      el.textContent = "";
      el.appendChild(head);
    }
    el.appendChild(t);
    commit();
  };
  const removeLine = (r: Element, i: number) => {
    // A primeira linha carrega a posição (y); passa para a seguinte antes de apagar.
    const next = runs[i + 1];
    if (i === 0 && next && r.getAttribute("y")) { next.setAttribute("y", r.getAttribute("y")!); next.removeAttribute("dy"); }
    r.remove();
    commit();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{runs.length > 1 ? "Linhas (ou trechos) do texto" : "Texto"}</p>
        {(runs.length ? runs : [el]).map((r, i) => (
          <div key={r.getAttribute("data-eid") ?? i} className="flex items-start gap-1.5">
            <Textarea
              rows={1}
              defaultValue={r.textContent ?? ""}
              onChange={(e) => { r.textContent = e.target.value.replace(/\n/g, " "); bump(); }}
              onBlur={() => commit()}
              className="min-h-8 flex-1 resize-none py-1.5 text-sm"
            />
            {runs.length > 0 && (
              <input type="color" title="Cor desta linha" value={toHex(r.getAttribute("fill") ?? el.getAttribute("fill"))} onChange={(e) => setAttr(r, "fill", e.target.value)} className="h-8 w-8 shrink-0 cursor-pointer rounded border bg-transparent" />
            )}
            {runs.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Apagar linha" onClick={() => removeLine(r, i)}><X className="h-3.5 w-3.5" /></Button>}
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1" onClick={addLine}><Plus className="h-3.5 w-3.5" />Adicionar linha</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Tamanho da fonte" value={fontSize} onChange={(v) => setForAll("font-size", String(v))} />
        <label className="block space-y-1 text-xs font-medium text-muted-foreground">Peso
          <select value={weight} onChange={(e) => setForAll("font-weight", e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground">
            {WEIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Cor do texto todo</p>
        <ColorField value={el.getAttribute("fill") ?? first.getAttribute("fill")} onChange={(v) => { runs.forEach((r) => r.removeAttribute("fill")); setAttr(el, "fill", v); }} />
      </div>
      <label className="block space-y-1 text-xs font-medium text-muted-foreground">Alinhamento
        <select value={anchor} onChange={(e) => setAttr(el, "text-anchor", e.target.value === "start" ? null : e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground">
          <option value="start">Pelo início</option><option value="middle">Pelo centro</option><option value="end">Pelo fim</option>
        </select>
      </label>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Zap className="mt-0.5 h-3 w-3 shrink-0" />O texto não quebra linha sozinho: use "Adicionar linha" para quebrar.</p>
    </div>
  );
}

// ─── Legenda ──────────────────────────────────────────────────────────────────

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
