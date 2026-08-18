import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  MousePointer2, Type, Square, Circle as CircleIcon,
  Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Save, X, Minus, Plus, ChevronUp, ChevronDown,
  Image as ImageIcon, Eye, EyeOff, Lock, Layers as LayersIcon, Hand,
  Upload, Pipette, ZoomIn, Slash, Triangle as TriangleIcon, ArrowLeftRight,
  GripVertical,
} from "lucide-react";

// ── Google Fonts ──────────────────────────────────────────────────────────────

export const DESIGN_FONTS = [
  "Inter", "Roboto", "Montserrat", "Open Sans", "Lato",
  "Oswald", "Raleway", "Poppins", "Nunito", "Playfair Display",
  "Bebas Neue", "Anton", "Pacifico", "Dancing Script", "Ubuntu",
  "Merriweather", "PT Sans", "Lobster", "Abril Fatface", "Righteous",
];

let _fontsInjected = false;
function injectGoogleFonts() {
  if (_fontsInjected || typeof document === "undefined") return;
  _fontsInjected = true;
  const families = DESIGN_FONTS.map((f) => `family=${f.replace(/ /g, "+")}:ital,wght@0,400;0,700;1,400`).join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

// A tag <link> do Google Fonts só baixa o arquivo da fonte de forma
// preguiçosa, quando o navegador percebe que precisa dela — e o fabric.js
// mede o texto (pra calcular a largura da caixa de seleção) no exato
// instante em que o objeto é criado. Se isso acontecer antes do download
// terminar, a medição usa a fonte de fallback (mais estreita) e a caixa
// fica pequena demais; quando a fonte real chega e o texto é redesenhado
// com glifos mais largos, ele passa por cima da própria caixa de seleção.
// document.fonts.load força o download e só resolve quando ele termina.
async function ensureFontLoaded(family: string, weight: string, italic: boolean) {
  if (typeof document === "undefined" || !(document as any).fonts?.load) return;
  const spec = `${italic ? "italic " : ""}${weight} 16px "${family}"`;
  try {
    await (document as any).fonts.load(spec);
  } catch {
    // Sem suporte à Font Loading API ou falha de rede — segue com o fallback.
  }
  // O fabric guarda a largura de cada caractere num cache GLOBAL (a página
  // toda, não por objeto), indexado por família+peso+estilo. Se qualquer
  // medição rodar antes da fonte carregar — mesmo de um texto diferente,
  // minutos atrás — o valor errado fica preso nesse cache PARA SEMPRE,
  // mesmo depois da fonte real já ter carregado. Esperar o load (acima)
  // sozinho não resolve depois que o cache já foi "envenenado" uma vez;
  // isso limpa a entrada da família pra forçar uma remedição correta.
  try {
    const { cache } = await import("fabric");
    cache.clearFontCache(family);
  } catch {
    // ignore
  }
}

// Corrige objetos de texto cuja caixa de seleção ficou desatualizada porque
// foram medidos antes da fonte real terminar de carregar (ver
// ensureFontLoaded acima) — limpa o cache de largura das fontes envolvidas,
// recalcula as dimensões com a fonte já disponível e redesenha.
async function refreshTextDimensions(canvas: any) {
  if (!canvas) return;
  const textObjs = canvas.getObjects().filter((o: any) => isText(o));
  if (textObjs.length === 0) return;
  try {
    const { cache } = await import("fabric");
    const families = new Set<string>(textObjs.map((o: any) => (o.fontFamily ?? "Montserrat") as string));
    families.forEach((f) => cache.clearFontCache(f));
  } catch {
    // ignore
  }
  for (const obj of textObjs) {
    obj.initDimensions();
    obj.setCoords();
  }
  canvas.requestRenderAll();
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tool = "select" | "text" | "rect" | "circle" | "line" | "triangle" | "eyedropper" | "zoom" | "pan";

// Selected object type guard
function isText(obj: any) {
  return obj?.type === "i-text" || obj?.type === "textbox";
}
function isBg(obj: any) {
  return obj?.name === "__bg__";
}
function isImage(obj: any) {
  return obj?.type === "image" && !isBg(obj);
}
function isLine(obj: any) {
  return obj?.type === "line";
}
function isShape(obj: any) {
  return obj && !isText(obj) && !isImage(obj) && obj.name !== "__bg__";
}

// Background fica travado — não é um elemento manipulável, só a base da arte.
const BG_IMAGE_PROPS = {
  selectable: false,
  evented: false,
  name: "__bg__",
} as const;

export interface DesignEditorProps {
  open: boolean;
  onClose: () => void;
  initialImageUrl?: string | null;
  /** Estado completo de um canvas fabric.js (canvas.toJSON()) já com textos posicionados.
   *  Quando presente, tem prioridade sobre `initialImageUrl` — usado pra abrir um
   *  template pronto (ou uma arte salva) pro usuário editar só o texto. */
  initialCanvasJson?: Record<string, unknown> | null;
  onSave: (dataUrl: string, canvasJson: Record<string, unknown>) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function DesignEditor({ open, onClose, initialImageUrl, initialCanvasJson, onSave }: DesignEditorProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  // O <div> do workspace só existe depois que o Dialog termina de montar o
  // conteúdo — os efeitos que anexam listeners nativos nele (roda do mouse,
  // arraste) rodavam ANTES disso, viam workspaceRef.current === null, e
  // como suas dependências não mudavam de novo, nunca tentavam de novo:
  // os listeners simplesmente nunca eram criados. `workspaceReady` dá um
  // gatilho pra esses efeitos rodarem de novo assim que o nó existir.
  const [workspaceReady, setWorkspaceReady] = useState(0);
  const setWorkspaceRef = useCallback((node: HTMLDivElement | null) => {
    workspaceRef.current = node;
    if (node) setWorkspaceReady((n) => n + 1);
  }, []);
  const fabricRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const elementImageInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);

  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [layersTick, setLayersTick] = useState(0);
  const refreshLayers = useCallback(() => setLayersTick((t) => t + 1), []);
  const [dragLayerIdx, setDragLayerIdx] = useState<number | null>(null);
  const [dragOverLayerIdx, setDragOverLayerIdx] = useState<number | null>(null);

  const spaceDownRef = useRef(false);
  const isPanningRef = useRef(false);
  // Posição do ponteiro e valor do pan no instante em que o gesto começou —
  // cada movimento recalcula o pan do zero a partir dessa âncora (em vez de
  // acumular delta a delta), pra não haver deriva se algum evento
  // intermediário vier fora de ordem ou duplicado.
  const startPosRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  // Um mousedown+arrastar+mouseup no mesmo elemento ainda dispara um evento
  // "click" logo depois — sem isso, o clique-pra-recentralizar reagia de
  // novo ao soltar o arraste, causando um salto extra.
  const dragMovedRef = useRef(false);
  const toolRef = useRef<Tool>("select");
  // O atalho de teclado (Delete/Ctrl+Z) é registrado num efeito que roda
  // antes de deleteSelected/undo serem declarados mais abaixo no componente
  // — referenciá-los direto ali daria "usado antes de declarado". Refs
  // evitam essa ordem: são preenchidas depois que as funções existem, e o
  // handler sempre lê a versão mais atual através delas.
  const deleteSelectedRef = useRef<() => void>(() => {});
  const undoRef = useRef<() => void>(() => {});
  // Deslocamento do pan (em px, sempre a partir do centro) — aplicado via
  // transform no wrapper do canvas. Não usamos scroll pra isso: com o
  // canvas em 100% de zoom ele quase sempre cabe inteiro na área de
  // trabalho, então não há overflow nenhum pra rolar e a "mão" parecia
  // travada. Transform funciona em qualquer zoom, com ou sem overflow.
  const panRef = useRef({ x: 0, y: 0 });
  const panContentRef = useRef<HTMLDivElement>(null);
  // panRef é o alvo (onde o pan "deveria" estar); renderedPanRef é o que
  // está na tela agora. Um loop de animação (abaixo) suaviza um em direção
  // ao outro a cada frame — assim, mesmo quando o input chega em saltos
  // grandes/irregulares (em vez de muitos eventos pequenos e contínuos), a
  // visão desliza de forma animada em vez de "teleportar".
  const renderedPanRef = useRef({ x: 0, y: 0 });

  const paintPan = useCallback(() => {
    const el = panContentRef.current;
    if (el) el.style.transform = `translate(${renderedPanRef.current.x}px, ${renderedPanRef.current.y}px)`;
  }, []);

  const resetPan = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    renderedPanRef.current = { x: 0, y: 0 };
    paintPan();
  }, [paintPan]);

  // Loop de acompanhamento do pan: enquanto o arraste está ativo, o
  // Photoshop rastreia o cursor 1:1, sem atraso nenhum — só suavizamos
  // (interpolando renderedPanRef em direção a panRef) fora de um arraste
  // ativo, ex: roda do mouse ou setas, pra não ficar "pulando" no clique.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const EASE = 0.35;
    const tick = () => {
      const target = panRef.current;
      const cur = renderedPanRef.current;
      if (isPanningRef.current) {
        if (cur.x !== target.x || cur.y !== target.y) { renderedPanRef.current = { ...target }; paintPan(); }
        raf = requestAnimationFrame(tick);
        return;
      }
      const dx = target.x - cur.x, dy = target.y - cur.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        if (dx !== 0 || dy !== 0) { renderedPanRef.current = { ...target }; paintPan(); }
      } else {
        renderedPanRef.current = { x: cur.x + dx * EASE, y: cur.y + dy * EASE };
        paintPan();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, paintPan]);

  // Text props
  const [fontFamily, setFontFamily] = useState("Montserrat");
  const [fontSize, setFontSize] = useState(52);
  const [textColor, setTextColor] = useState("#ffffff");
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [align, setAlign] = useState<"left" | "center" | "right">("center");

  // Shape props
  const [shapeColor, setShapeColor] = useState("#00bcd4");
  const [shapeOpacity, setShapeOpacity] = useState(100);

  // Cor de frente/fundo (como os swatches do Photoshop) — só um atalho
  // visual: "frente" aplica no elemento selecionado, "fundo" pinta o fundo
  // da arte. Ficam sincronizados com o conta-gotas e com os seletores já
  // existentes no painel direito.
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [canvasBgColor, setCanvasBgColor] = useState("#ffffff");

  // ── Fabric init ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    injectGoogleFonts();
    setTool("select");

    let canvas: any;
    let disposed = false;

    (async () => {
      const { Canvas, FabricImage } = await import("fabric");
      if (disposed || !canvasElRef.current) return;

      canvas = new Canvas(canvasElRef.current, {
        width: 540,
        height: 675,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      fabricRef.current = canvas;
      historyRef.current = [];
      historyIdxRef.current = -1;
      spaceDownRef.current = false;
      isPanningRef.current = false;
      setZoom(1);
      resetPan();

      if (initialCanvasJson) {
        // Estado completo já montado (template ou arte salva) — carrega direto,
        // preservando os textos/posições já colocados.
        try {
          await canvas.loadFromJSON(initialCanvasJson);
          const bg = canvas.getObjects().find((o: any) => isBg(o));
          if (bg) bg.set(BG_IMAGE_PROPS);
          canvas.renderAll();
          // As fontes dos textos já salvos podem não ter terminado de
          // carregar ainda — corrige as caixas de seleção assim que
          // estiverem prontas (ver ensureFontLoaded/refreshTextDimensions).
          const textObjs = canvas.getObjects().filter((o: any) => isText(o));
          await Promise.all(
            textObjs.map((o: any) => ensureFontLoaded(o.fontFamily ?? "Montserrat", o.fontWeight === "bold" ? "700" : "400", o.fontStyle === "italic"))
          );
          if (!disposed) await refreshTextDimensions(canvas);
        } catch (err) {
          console.warn("[DesignEditor] initialCanvasJson failed to load:", err);
        }
      } else if (initialImageUrl) {
        // Background image
        try {
          let src = initialImageUrl;
          if (/^https?:\/\//i.test(initialImageUrl)) {
            src = `/api/image-proxy?url=${encodeURIComponent(initialImageUrl)}`;
          }
          const img = await FabricImage.fromURL(src);
          if (img.width && img.height) {
            // "contain" (não "cover"): mostra a arte inteira, centralizada, sem cortar bordas
            const scale = Math.min(540 / img.width, 675 / img.height);
            img.set({
              scaleX: scale, scaleY: scale,
              left: (540 - img.width * scale) / 2,
              top: (675 - img.height * scale) / 2,
              originX: "left", originY: "top",
              ...BG_IMAGE_PROPS,
            });
            canvas.add(img);
            canvas.sendObjectToBack(img);
            canvas.renderAll();
          }
        } catch (err) {
          console.warn("[DesignEditor] background image failed to load:", err);
        }
      }

      // Selection
      canvas.on("selection:created", (e: any) => syncSelected(e.selected?.[0]));
      canvas.on("selection:updated", (e: any) => syncSelected(e.selected?.[0]));
      canvas.on("selection:cleared", () => setSelected(null));

      // History
      const saveHistory = () => {
        const json = JSON.stringify(canvas.toJSON(["name"]));
        const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1);
        trimmed.push(json);
        historyRef.current = trimmed.slice(-30);
        historyIdxRef.current = historyRef.current.length - 1;
      };
      canvas.on("object:added", (e: any) => {
        // Sem isso, o fabric anexa o <textarea> oculto que capta a
        // digitação (usado pra editar o texto) direto no <body> — fora da
        // árvore do Dialog. O FocusScope do Radix trava o foco dentro do
        // diálogo e devolve o foco pra lá sempre que algo fora dele é
        // focado, então esse textarea nunca fica focado de verdade: dá pra
        // clicar/selecionar (isso é só desenho no canvas), mas digitar não
        // faz nada. Isso precisa ser reaplicado a cada objeto adicionado
        // (não é serializado no JSON, então undo/redo e templates recarregados
        // perdem o valor de novo).
        if (isText(e.target)) e.target.hiddenTextareaContainer = workspaceRef.current;
        saveHistory();
        refreshLayers();
      });
      canvas.on("object:modified", saveHistory);
      canvas.on("object:removed", () => { saveHistory(); refreshLayers(); });

      refreshLayers();
      canvas.renderAll();

      // Rede de segurança: se alguma fonte ainda estiver carregando por
      // outro motivo (ex: digitada com uma fonte antes do próprio
      // documento terminar de processá-la), corrige assim que o browser
      // sinalizar que todas as fontes pendentes terminaram.
      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        (document as any).fonts.ready.then(() => {
          if (!disposed) refreshTextDimensions(canvas);
        });
      }
    })();

    return () => {
      disposed = true;
      if (canvas) { canvas.dispose(); fabricRef.current = null; }
    };
  }, [open, initialImageUrl, initialCanvasJson]);

  // Segurar espaço para arrastar o canvas (pan), como no Canva/Figma.
  // Ignora quando o foco está em um campo de texto (inclui o textarea
  // que o fabric usa por trás dos panos pra edição de texto no canvas).
  useEffect(() => {
    if (!open) return;
    const isTyping = (target: EventTarget | null) => {
      const tag = (target as HTMLElement)?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (target as HTMLElement)?.isContentEditable;
    };
    const arrowSteps: Record<string, [number, number]> = {
      ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [1, 0], ArrowRight: [-1, 0],
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Delete/Backspace apaga o objeto selecionado — mas não quando o
      // usuário está digitando dentro de um texto (aí é apagar caractere,
      // comportamento nativo do textarea oculto do fabric) nem em nenhum
      // outro campo de formulário.
      if ((e.key === "Delete" || e.key === "Backspace") && !isTyping(e.target)) {
        const obj = fabricRef.current?.getActiveObject();
        if (obj && !isBg(obj)) {
          e.preventDefault();
          deleteSelectedRef.current();
        }
        return;
      }
      // Ctrl/Cmd+Z desfaz a última alteração.
      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && !isTyping(e.target)) {
        e.preventDefault();
        undoRef.current();
        return;
      }
      // Setas movem a visão com a ferramenta "Mão" ativa — alternativa ao
      // clique+arraste, útil quando o drag do mouse não é confiável.
      const arrowStep = arrowSteps[e.key];
      if (arrowStep && toolRef.current === "pan" && !isTyping(e.target)) {
        const amount = e.shiftKey ? 120 : 40;
        panRef.current = { x: panRef.current.x + arrowStep[0] * amount, y: panRef.current.y + arrowStep[1] * amount };
        e.preventDefault();
        return;
      }
      if (e.code !== "Space" || isTyping(e.target) || spaceDownRef.current) return;
      spaceDownRef.current = true;
      const canvas = fabricRef.current;
      if (canvas) {
        canvas.defaultCursor = "grab";
        canvas.selection = false;
        canvas.skipTargetFind = true;
      }
      if (workspaceRef.current) workspaceRef.current.style.cursor = "grab";
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceDownRef.current = false;
      const canvas = fabricRef.current;
      const panning = toolRef.current === "pan";
      if (canvas) {
        canvas.defaultCursor = panning ? "grab" : "default";
        canvas.selection = !panning;
        canvas.skipTargetFind = panning;
      }
      if (workspaceRef.current) workspaceRef.current.style.cursor = panning ? "grab" : "";
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [open]);

  // Ferramenta "Mão" (igual ao Photoshop/Canva): com ela ativa, clicar e
  // arrastar em qualquer lugar do canvas move a visão, sem selecionar nem
  // mexer nos elementos da arte.
  useEffect(() => {
    toolRef.current = tool;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const panning = tool === "pan";
    // Zoom e conta-gotas também não devem selecionar/arrastar elementos ao
    // clicar no canvas — só a ferramenta "Mão" descarta o objeto ativo
    // (linha abaixo), as outras duas preservam a seleção pra poder aplicar
    // a cor coletada ou simplesmente não perder o que estava selecionado.
    const clickThrough = panning || tool === "zoom" || tool === "eyedropper";
    canvas.selection = !clickThrough;
    canvas.skipTargetFind = clickThrough;
    canvas.defaultCursor = panning ? "grab" : tool === "zoom" ? "zoom-in" : tool === "eyedropper" ? "crosshair" : "default";
    canvas.hoverCursor = panning ? "grab" : "move";
  }, [tool]);

  function syncSelected(obj: any) {
    setSelected(obj ?? null);
    if (!obj) return;
    if (isText(obj)) {
      setFontFamily(obj.fontFamily ?? "Montserrat");
      setFontSize(obj.fontSize ?? 52);
      setTextColor(typeof obj.fill === "string" ? obj.fill : "#ffffff");
      setBold(obj.fontWeight === "bold");
      setItalic(obj.fontStyle === "italic");
      setAlign(obj.textAlign ?? "center");
    } else if (isImage(obj)) {
      setShapeOpacity(Math.round((obj.opacity ?? 1) * 100));
    } else if (isShape(obj)) {
      // Linha não tem preenchimento visível — sua "cor" é o traço (stroke).
      const colorProp = isLine(obj) ? obj.stroke : obj.fill;
      setShapeColor(typeof colorProp === "string" ? colorProp : "#00bcd4");
      setShapeOpacity(Math.round((obj.opacity ?? 1) * 100));
    }
  }

  // ── Apply to selected ─────────────────────────────────────────────────────

  function applyProp(prop: string, value: unknown) {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    obj.set(prop as any, value);
    fabricRef.current.renderAll();
  }

  // ── Tools ─────────────────────────────────────────────────────────────────

  const addText = useCallback(async () => {
    const { IText } = await import("fabric");
    const canvas = fabricRef.current;
    if (!canvas) return;
    await ensureFontLoaded(fontFamily, bold ? "700" : "400", italic);
    const text = new IText("Seu texto aqui", {
      // 675 é a altura lógica fixa da arte — não usar canvas.height aqui,
      // pois o zoom redimensiona o canvas de verdade (ver applyZoom).
      left: 80, top: 675 / 2 - 30,
      originX: "left", originY: "top",
      fontFamily, fontSize, fill: textColor,
      fontWeight: bold ? "bold" : "normal",
      fontStyle: italic ? "italic" : "normal",
      textAlign: align,
      width: 380,
    } as any);
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    setTool("select");
  }, [fontFamily, fontSize, textColor, bold, italic, align]);

  const addRect = useCallback(async () => {
    const { Rect } = await import("fabric");
    const canvas = fabricRef.current;
    if (!canvas) return;
    const rect = new Rect({
      left: 80, top: 550,
      originX: "left", originY: "top",
      width: 380, height: 72,
      fill: shapeColor,
      opacity: shapeOpacity / 100,
      rx: 14, ry: 14,
    } as any);
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    setTool("select");
  }, [shapeColor, shapeOpacity]);

  const addCircle = useCallback(async () => {
    const { Circle } = await import("fabric");
    const canvas = fabricRef.current;
    if (!canvas) return;
    const circle = new Circle({
      left: 180, top: 200,
      originX: "left", originY: "top",
      radius: 80,
      fill: shapeColor,
      opacity: shapeOpacity / 100,
    } as any);
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    setTool("select");
  }, [shapeColor, shapeOpacity]);

  const addLine = useCallback(async () => {
    const { Line } = await import("fabric");
    const canvas = fabricRef.current;
    if (!canvas) return;
    const line = new Line([80, 300, 460, 300], {
      stroke: shapeColor,
      strokeWidth: 6,
      opacity: shapeOpacity / 100,
    } as any);
    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.renderAll();
    setTool("select");
  }, [shapeColor, shapeOpacity]);

  const addTriangle = useCallback(async () => {
    const { Triangle } = await import("fabric");
    const canvas = fabricRef.current;
    if (!canvas) return;
    const triangle = new Triangle({
      left: 180, top: 180,
      originX: "left", originY: "top",
      width: 160, height: 140,
      fill: shapeColor,
      opacity: shapeOpacity / 100,
    } as any);
    canvas.add(triangle);
    canvas.setActiveObject(triangle);
    canvas.renderAll();
    setTool("select");
  }, [shapeColor, shapeOpacity]);

  // Upload de imagem como ELEMENTO solto na arte (diferente de "Trocar
  // fundo": fica por cima, é movível/redimensionável, não trava no lugar).
  const addImageElement = useCallback(async (file: File) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const { FabricImage } = await import("fabric");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = ev.target?.result as string;
      const img = await FabricImage.fromURL(src);
      const maxDim = 260;
      const scale = Math.min(maxDim / (img.width || 1), maxDim / (img.height || 1), 1);
      img.set({
        scaleX: scale, scaleY: scale,
        left: (540 - (img.width || 0) * scale) / 2,
        top: (675 - (img.height || 0) * scale) / 2,
        originX: "left", originY: "top",
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      setTool("select");
    };
    reader.readAsDataURL(file);
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && !isBg(obj)) {
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.renderAll();
      setSelected(null);
    }
  }, []);

  const undo = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const state = JSON.parse(historyRef.current[historyIdxRef.current]);
    canvas.loadFromJSON(state).then(() => { canvas.renderAll(); refreshLayers(); });
  }, [refreshLayers]);
  deleteSelectedRef.current = deleteSelected;
  undoRef.current = undo;

  const layerUp = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (obj) { canvas.bringObjectForward(obj); canvas.renderAll(); refreshLayers(); }
  }, [refreshLayers]);

  const layerDown = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (obj && !isBg(obj)) { canvas.sendObjectBackwards(obj); canvas.renderAll(); refreshLayers(); }
  }, [refreshLayers]);

  // ── Camadas (lista/seleção/reordenação/visibilidade de cada elemento) ──────

  const selectLayer = useCallback((obj: any) => {
    const canvas = fabricRef.current;
    if (!canvas || isBg(obj)) return;
    canvas.setActiveObject(obj);
    canvas.renderAll();
    syncSelected(obj);
  }, []);

  const moveLayer = useCallback((obj: any, dir: 1 | -1) => {
    const canvas = fabricRef.current;
    if (!canvas || isBg(obj)) return;
    const objects = canvas.getObjects();
    const target = objects[objects.indexOf(obj) + dir];
    if (!target || isBg(target)) return;
    if (dir === 1) canvas.bringObjectForward(obj);
    else canvas.sendObjectBackwards(obj);
    canvas.renderAll();
    refreshLayers();
  }, [refreshLayers]);

  // Arrastar e soltar uma camada pra reordenar. `fromIdx`/`toIdx` são
  // índices na lista exibida (invertida: topo = na frente). Move o objeto
  // pro índice exibido de destino calculando a nova pilha completa e
  // aplicando com moveObjectTo — mais simples que ficar chamando
  // bringForward/sendBackwards um passo de cada vez.
  const reorderLayer = useCallback((fromIdx: number, toIdx: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const displayOrder = [...canvas.getObjects()].reverse();
    const moved = displayOrder[fromIdx];
    if (!moved || isBg(moved)) return;
    const bgIdx = displayOrder.findIndex((o: any) => isBg(o));
    // A imagem de fundo fica sempre travada no fim da lista — nada pode
    // ser solto depois dela.
    const maxIdx = bgIdx === -1 ? displayOrder.length - 1 : bgIdx - 1;
    const to = Math.max(0, Math.min(toIdx, maxIdx));
    if (to === fromIdx) return;
    const next = displayOrder.filter((_: any, i: number) => i !== fromIdx);
    next.splice(to, 0, moved);
    const newStackOrder = [...next].reverse();
    canvas.moveObjectTo(moved, newStackOrder.indexOf(moved));
    canvas.renderAll();
    refreshLayers();
  }, [refreshLayers]);

  const toggleLayerVisibility = useCallback((obj: any) => {
    obj.visible = obj.visible === false ? true : false;
    fabricRef.current?.renderAll();
    refreshLayers();
  }, [refreshLayers]);

  const deleteLayer = useCallback((obj: any) => {
    const canvas = fabricRef.current;
    if (!canvas || isBg(obj)) return;
    if (canvas.getActiveObject() === obj) { canvas.discardActiveObject(); setSelected(null); }
    canvas.remove(obj);
    canvas.renderAll();
    refreshLayers();
  }, [refreshLayers]);

  // ── Zoom / pan ───────────────────────────────────────────────────────────
  // O zoom redimensiona o canvas de verdade (em vez de só escalar o que é
  // desenhado dentro de um quadro fixo) — assim dar zoom nunca corta a arte,
  // só deixa ela maior/menor. O pan usa um transform (translate) no wrapper
  // do canvas, não scroll: em 100% de zoom o canvas quase sempre cabe
  // inteiro na área de trabalho (sem overflow nenhum pra rolar), então
  // scroll-based pan não tinha o que mover. Transform funciona sempre.

  const applyZoom = useCallback((z: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const clamped = Math.min(4, Math.max(0.25, z));
    canvas.setDimensions({ width: 540 * clamped, height: 675 * clamped });
    canvas.setZoom(clamped);
    canvas.renderAll();
    setZoom(clamped);
    resetPan();
  }, [resetPan]);

  const resetZoom = useCallback(() => applyZoom(1), [applyZoom]);

  // Roda do mouse com Ctrl/Cmd = zoom; roda sozinha pan (como no Figma).
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        applyZoom(canvas.getZoom() * (0.998 ** e.deltaY));
        return;
      }
      panRef.current = { x: panRef.current.x - e.deltaX, y: panRef.current.y - e.deltaY };
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, applyZoom, workspaceReady]);

  // Pan: segurar espaço (em qualquer ferramenta) ou usar a ferramenta "Mão"
  // e arrastar — desloca o wrapper do canvas (transform), não os elementos.
  // Só Pointer Events, com captura de ponteiro (o mesmo padrão usado por
  // Figma/Excalidraw/etc pra arrastar um canvas): o elemento continua
  // recebendo pointermove/pointerup mesmo se o cursor sair dele, sem
  // precisar ouvir em `window` nem coordenar múltiplas famílias de evento.
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el || !open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!spaceDownRef.current && toolRef.current !== "pan") return;
      el.setPointerCapture(e.pointerId);
      isPanningRef.current = true;
      dragMovedRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...panRef.current };
      el.style.cursor = "grabbing";
      fabricRef.current?.discardActiveObject();
      fabricRef.current?.renderAll();
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      if (Math.abs(e.clientX - startPosRef.current.x) > 3 || Math.abs(e.clientY - startPosRef.current.y) > 3) dragMovedRef.current = true;
      // O ponto "agarrado" pela mão segue o cursor 1:1 (efeito "gancho"):
      // arrastar pra direita revela a parte esquerda da arte, como no
      // Photoshop — sempre recalculado a partir da âncora do início do
      // gesto, nunca por acúmulo de delta a delta.
      panRef.current = {
        x: panStartRef.current.x + (e.clientX - startPosRef.current.x),
        y: panStartRef.current.y + (e.clientY - startPosRef.current.y),
      };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      el.releasePointerCapture(e.pointerId);
      isPanningRef.current = false;
      el.style.cursor = spaceDownRef.current || toolRef.current === "pan" ? "grab" : "";
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [open, workspaceReady]);

  // Amostra a cor do pixel composto (fundo + todos os elementos) sob o
  // cursor — igual ao conta-gotas do Photoshop, que lê o pixel renderizado
  // em vez de propriedades do objeto (funciona sobre imagens, gradientes etc).
  const pickColorAt = useCallback((clientX: number, clientY: number): string | null => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return null;
    const rect = canvasEl.getBoundingClientRect();
    const x = Math.round((clientX - rect.left) * (canvasEl.width / rect.width));
    const y = Math.round((clientY - rect.top) * (canvasEl.height / rect.height));
    if (x < 0 || y < 0 || x >= canvasEl.width || y >= canvasEl.height) return null;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return null;
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }, []);

  // Clique único com a ferramenta "Mão" ativa recentraliza a visão no ponto
  // clicado — alternativa que não depende de "segurar e arrastar" continuar
  // pressionado, só de um clique simples (mais robusto em alguns ambientes).
  // A mesma função também cobre as ferramentas "Zoom" (clique = mais perto,
  // Alt+clique = mais longe) e "Conta-gotas" (clique = coleta a cor).
  const onWorkspaceClick = useCallback((e: React.MouseEvent) => {
    // O "click" que fecha um mousedown+arraste+mouseup dispara DEPOIS que
    // isPanningRef já voltou a false — por isso o guard real é dragMovedRef,
    // não isPanningRef (que só cobre um clique durante um arraste em curso).
    if (isPanningRef.current || dragMovedRef.current) return;
    const t = toolRef.current;

    if (t === "zoom") {
      const canvas = fabricRef.current;
      if (!canvas) return;
      applyZoom(canvas.getZoom() * (e.altKey ? 1 / 1.25 : 1.25));
      return;
    }

    if (t === "eyedropper") {
      const color = pickColorAt(e.clientX, e.clientY);
      if (color) { applyColor(color); setForegroundColor(color); }
      setTool("select");
      return;
    }

    if (t !== "pan") return;
    const el = workspaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - e.clientX;
    const dy = rect.top + rect.height / 2 - e.clientY;
    panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
  }, [applyZoom, pickColorAt]);

  // ── Background image upload ───────────────────────────────────────────────

  const handleBgUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;
    const { FabricImage } = await import("fabric");
    const canvas = fabricRef.current;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = ev.target?.result as string;
      const img = await FabricImage.fromURL(src);
      const scale = Math.min(540 / img.width!, 675 / img.height!);
      img.set({
        scaleX: scale, scaleY: scale,
        left: (540 - img.width! * scale) / 2,
        top: (675 - img.height! * scale) / 2,
        originX: "left", originY: "top",
        ...BG_IMAGE_PROPS,
      });
      const old = canvas.getObjects().find((o: any) => o.name === "__bg__");
      if (old) canvas.remove(old);
      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.renderAll();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  // ── Export / Save ─────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    // Exportar precisa ignorar o zoom/pan da navegação (senão salva o
    // canvas redimensionado/deslocado da hora, em vez da arte inteira).
    canvas.setDimensions({ width: 540, height: 675 });
    canvas.setZoom(1);
    canvas.renderAll();
    // small delay so renderAll finishes before capture
    await new Promise((r) => setTimeout(r, 80));
    try {
      const dataUrl: string = canvas.toDataURL({
        format: "jpeg",
        quality: 0.92,
        multiplier: 2,
        enableRetinaScaling: false,
      });
      if (!dataUrl || dataUrl === "data:,") {
        toast.error("Erro ao exportar o design.");
        return;
      }
      onSave(dataUrl, canvas.toJSON(["name"]));
      toast.success("Design salvo!");
      onClose();
    } catch (err) {
      console.error("[DesignEditor] export failed:", err);
      toast.error("Erro ao exportar o design.");
    }
  }, [onSave, onClose]);

  // ── Palette ───────────────────────────────────────────────────────────────

  const PALETTE = [
    "#ffffff", "#000000", "#1a1a2e", "#00bcd4", "#00e5ff",
    "#ff5722", "#ff9800", "#ffd700", "#4caf50", "#2196f3",
    "#9c27b0", "#e91e63", "#607d8b", "#795548", "#f5f5f5",
  ];

  function applyColor(color: string) {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    if (isText(obj)) { setTextColor(color); applyProp("fill", color); }
    else if (isLine(obj)) { setShapeColor(color); applyProp("stroke", color); }
    else if (isShape(obj)) { setShapeColor(color); applyProp("fill", color); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const textSel = isText(selected);
  const shapeSel = isShape(selected);
  const imageSel = isImage(selected);
  const lineSel = isLine(selected);
  const layers = fabricRef.current ? [...fabricRef.current.getObjects()].reverse() : [];
  void layersTick; // força reler getObjects() acima a cada mudança de camadas

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="!max-w-[95vw] !w-[95vw] !h-[95vh] p-0 !flex flex-col overflow-hidden !gap-0 [&>button]:hidden bg-[#323232] text-[#cccccc] border-[#1b1b1b] select-none"
        style={{ maxWidth: "95vw", width: "95vw", height: "95vh" }}
      >

        {/* Top bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1b1b1b] bg-[#252525] shrink-0">
          <span className="font-semibold text-xs text-[#cccccc] tracking-wide">Editor de Design</span>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-xs h-7 bg-[#3f3f3f] border-[#5a5a5a] text-[#cccccc] hover:bg-[#4a4a4a] hover:text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Trocar fundo
            </Button>
            <Button size="sm" className="gap-1.5 text-xs h-7 bg-[#0c8ce9] hover:bg-[#0f7ad1] text-white" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" /> Salvar no slide
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-[#999999] hover:text-white hover:bg-[#4a4a4a]" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left toolbar */}
          <div className="w-12 border-r border-[#1b1b1b] flex flex-col items-center gap-0.5 py-2 bg-[#2b2b2b] shrink-0 overflow-y-auto">
            {([
              { id: "select" as Tool, Icon: MousePointer2, label: "Selecionar", action: () => setTool("select") },
              { id: "pan" as Tool, Icon: Hand, label: "Mover a visão (arraste, segure espaço, ou use as setas do teclado)", action: () => setTool("pan") },
              { id: "zoom" as Tool, Icon: ZoomIn, label: "Zoom (clique = aproxima, Alt+clique = afasta)", action: () => setTool("zoom") },
              { id: "eyedropper" as Tool, Icon: Pipette, label: "Conta-gotas (clique em qualquer ponto da arte pra coletar a cor)", action: () => setTool("eyedropper") },
              { id: "text" as Tool, Icon: Type, label: "Texto", action: () => { setTool("text"); addText(); } },
              { id: "rect" as Tool, Icon: Square, label: "Retângulo", action: () => { setTool("rect"); addRect(); } },
              { id: "circle" as Tool, Icon: CircleIcon, label: "Círculo", action: () => { setTool("circle"); addCircle(); } },
              { id: "triangle" as Tool, Icon: TriangleIcon, label: "Triângulo", action: () => { setTool("triangle"); addTriangle(); } },
              { id: "line" as Tool, Icon: Slash, label: "Linha", action: () => { setTool("line"); addLine(); } },
            ]).map(({ id, Icon, label, action }) => (
              <button key={id} title={label} onClick={action}
                className={cn(
                  "w-9 h-9 rounded-[3px] flex items-center justify-center transition-colors shrink-0",
                  tool === id ? "bg-[#0c8ce9] text-white" : "text-[#999999] hover:bg-[#3f3f3f] hover:text-white"
                )}>
                <Icon className="w-4 h-4" />
              </button>
            ))}

            <div className="w-7 border-t border-[#1b1b1b] my-1 shrink-0" />

            <button title="Subir camada" onClick={layerUp} disabled={!selected}
              className="w-9 h-9 rounded-[3px] flex items-center justify-center text-[#999999] hover:bg-[#3f3f3f] hover:text-white disabled:opacity-30 transition-colors shrink-0">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button title="Descer camada" onClick={layerDown} disabled={!selected}
              className="w-9 h-9 rounded-[3px] flex items-center justify-center text-[#999999] hover:bg-[#3f3f3f] hover:text-white disabled:opacity-30 transition-colors shrink-0">
              <ChevronDown className="w-4 h-4" />
            </button>

            <div className="mt-auto shrink-0 flex flex-col items-center">
              <button title="Desfazer" onClick={undo}
                className="w-9 h-9 rounded-[3px] flex items-center justify-center text-[#999999] hover:bg-[#3f3f3f] hover:text-white transition-colors text-[10px] font-bold">
                ↩
              </button>
              <button title="Excluir" onClick={deleteSelected} disabled={!selected || isBg(selected)}
                className="w-9 h-9 rounded-[3px] flex items-center justify-center text-[#999999] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Cor de frente / fundo, como os swatches do Photoshop —
                  "frente" pinta o elemento selecionado, "fundo" pinta o
                  fundo da arte; a seta troca as duas. */}
              <button title="Trocar cor de frente/fundo" onClick={() => {
                const nextFg = canvasBgColor, nextBg = foregroundColor;
                setForegroundColor(nextFg); setCanvasBgColor(nextBg);
                applyColor(nextFg);
                fabricRef.current?.set("backgroundColor", nextBg);
                fabricRef.current?.renderAll();
              }} className="w-9 h-9 rounded-[3px] flex items-center justify-center text-[#999999] hover:bg-[#3f3f3f] hover:text-white transition-colors mt-1">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
              <div className="relative w-9 h-9 mb-2" title="Cor de frente / cor de fundo">
                <label className="absolute bottom-0 right-0 w-6 h-6 rounded-sm border border-[#1b1b1b] shadow cursor-pointer block"
                  style={{ backgroundColor: canvasBgColor }}>
                  <input type="color" className="opacity-0 w-0 h-0 absolute" value={canvasBgColor}
                    onChange={(e) => { const c = e.target.value; setCanvasBgColor(c); fabricRef.current?.set("backgroundColor", c); fabricRef.current?.renderAll(); }} />
                </label>
                <label className="absolute top-0 left-0 w-6 h-6 rounded-sm border border-[#1b1b1b] shadow cursor-pointer block z-10"
                  style={{ backgroundColor: foregroundColor }}>
                  <input type="color" className="opacity-0 w-0 h-0 absolute" value={foregroundColor}
                    onChange={(e) => { applyColor(e.target.value); setForegroundColor(e.target.value); }} />
                </label>
              </div>
            </div>
          </div>

          {/* Canvas workspace */}
          <div
            className="flex-1 relative overflow-hidden"
            style={{
              backgroundColor: "#1e1e1e",
              backgroundImage: "radial-gradient(#2c2c2c 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          >
            <div ref={setWorkspaceRef} onClick={onWorkspaceClick} className={cn("w-full h-full overflow-hidden", tool === "pan" && "cursor-grab")}>
              <div ref={panContentRef} className="w-full h-full flex items-center justify-center">
                <div className="shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.6)] rounded-sm overflow-hidden bg-white shrink-0">
                  <canvas ref={canvasElRef} />
                </div>
              </div>
            </div>

            {/* Zoom controls — roda do mouse com Ctrl/Cmd também dá zoom (a arte
                fica maior/menor sem nunca ser cortada); segurar espaço, ou usar
                a ferramenta "Mão", e arrastar navega pela arte (pan). */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[#2b2b2b]/95 border border-[#4a4a4a] rounded-md shadow-lg px-1.5 py-1.5">
              <button title="Diminuir zoom" onClick={() => applyZoom(zoom - 0.1)}
                className="h-7 w-7 rounded flex items-center justify-center text-[#999999] hover:bg-[#3f3f3f] hover:text-white transition-colors">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button title="Redefinir zoom (100%)" onClick={resetZoom}
                className="text-[11px] font-medium text-[#cccccc] w-11 text-center hover:text-white transition-colors">
                {Math.round(zoom * 100)}%
              </button>
              <button title="Aumentar zoom" onClick={() => applyZoom(zoom + 0.1)}
                className="h-7 w-7 rounded flex items-center justify-center text-[#999999] hover:bg-[#3f3f3f] hover:text-white transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right properties */}
          <div className="w-64 border-l border-[#1b1b1b] bg-[#2b2b2b] overflow-y-auto shrink-0">
            <div className="p-3 space-y-4">

              {/* Text properties */}
              {(textSel || tool === "text") && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-wider border-b border-[#1b1b1b] pb-1.5">Texto</p>

                  <div>
                    <label className="text-[10px] text-[#999999] mb-1 block">Fonte</label>
                    <select
                      className="w-full h-8 rounded-[3px] border border-[#5a5a5a] bg-[#1e1e1e] text-[#e0e0e0] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0c8ce9]"
                      value={fontFamily}
                      style={{ fontFamily }}
                      onChange={async (e) => {
                        const f = e.target.value;
                        setFontFamily(f);
                        await ensureFontLoaded(f, bold ? "700" : "400", italic);
                        applyProp("fontFamily", f);
                      }}
                    >
                      {DESIGN_FONTS.map((f) => (
                        <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#999999] mb-1 block">Tamanho</label>
                    <div className="flex items-center gap-1">
                      <button className="h-7 w-7 rounded-[3px] border border-[#5a5a5a] flex items-center justify-center text-[#999999] hover:bg-[#3f3f3f] hover:text-white transition-colors"
                        onClick={() => { const s = Math.max(8, fontSize - 2); setFontSize(s); applyProp("fontSize", s); }}>
                        <Minus className="w-3 h-3" />
                      </button>
                      <input type="number" className="flex-1 h-7 rounded-[3px] border border-[#5a5a5a] bg-[#1e1e1e] text-[#e0e0e0] text-center text-xs focus:outline-none"
                        value={fontSize}
                        onChange={(e) => { const s = Number(e.target.value); setFontSize(s); applyProp("fontSize", s); }} />
                      <button className="h-7 w-7 rounded-[3px] border border-[#5a5a5a] flex items-center justify-center text-[#999999] hover:bg-[#3f3f3f] hover:text-white transition-colors"
                        onClick={() => { const s = fontSize + 2; setFontSize(s); applyProp("fontSize", s); }}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#999999] mb-1 block">Cor do texto</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="h-8 w-10 rounded-[3px] border border-[#5a5a5a] p-0.5 cursor-pointer bg-[#1e1e1e]"
                        value={textColor} onChange={(e) => { setTextColor(e.target.value); applyProp("fill", e.target.value); }} />
                      <input className="flex-1 h-8 rounded-[3px] border border-[#5a5a5a] bg-[#1e1e1e] text-[#e0e0e0] px-2 text-xs uppercase font-mono focus:outline-none"
                        value={textColor} onChange={(e) => { setTextColor(e.target.value); applyProp("fill", e.target.value); }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {([
                      { state: bold, set: setBold, icon: Bold, prop: "fontWeight", on: "bold", off: "normal" },
                      { state: italic, set: setItalic, icon: Italic, prop: "fontStyle", on: "italic", off: "normal" },
                    ] as const).map(({ state, set, icon: Icon, prop, on, off }) => (
                      <button key={prop}
                        onClick={() => { const v = !state; (set as any)(v); applyProp(prop, v ? on : off); }}
                        className={cn("h-7 w-7 rounded-[3px] border flex items-center justify-center transition-colors",
                          state ? "bg-[#0c8ce9] text-white border-[#0c8ce9]" : "border-[#5a5a5a] text-[#999999] hover:bg-[#3f3f3f] hover:text-white")}>
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                    <div className="flex-1" />
                    {(["left", "center", "right"] as const).map((a, i) => {
                      const Icon = [AlignLeft, AlignCenter, AlignRight][i];
                      return (
                        <button key={a} onClick={() => { setAlign(a); applyProp("textAlign", a); }}
                          className={cn("h-7 w-7 rounded-[3px] border flex items-center justify-center transition-colors",
                            align === a ? "bg-[#0c8ce9] text-white border-[#0c8ce9]" : "border-[#5a5a5a] text-[#999999] hover:bg-[#3f3f3f] hover:text-white")}>
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shape properties */}
              {shapeSel && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-wider border-b border-[#1b1b1b] pb-1.5">Forma</p>
                  <div>
                    <label className="text-[10px] text-[#999999] mb-1 block">Cor</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="h-8 w-10 rounded-[3px] border border-[#5a5a5a] p-0.5 cursor-pointer bg-[#1e1e1e]"
                        value={shapeColor} onChange={(e) => { setShapeColor(e.target.value); applyProp(lineSel ? "stroke" : "fill", e.target.value); }} />
                      <input className="flex-1 h-8 rounded-[3px] border border-[#5a5a5a] bg-[#1e1e1e] text-[#e0e0e0] px-2 text-xs uppercase font-mono focus:outline-none"
                        value={shapeColor} onChange={(e) => { setShapeColor(e.target.value); applyProp(lineSel ? "stroke" : "fill", e.target.value); }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#999999] mb-1 block">Opacidade: {shapeOpacity}%</label>
                    <input type="range" min={10} max={100} step={5} className="w-full accent-[#0c8ce9]"
                      value={shapeOpacity} onChange={(e) => { const v = Number(e.target.value); setShapeOpacity(v); applyProp("opacity", v / 100); }} />
                  </div>
                </div>
              )}

              {/* Image element properties */}
              {imageSel && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-wider border-b border-[#1b1b1b] pb-1.5">Imagem</p>
                  <div>
                    <label className="text-[10px] text-[#999999] mb-1 block">Opacidade: {shapeOpacity}%</label>
                    <input type="range" min={10} max={100} step={5} className="w-full accent-[#0c8ce9]"
                      value={shapeOpacity} onChange={(e) => { const v = Number(e.target.value); setShapeOpacity(v); applyProp("opacity", v / 100); }} />
                  </div>
                </div>
              )}

              {!selected && tool === "select" && (
                <p className="text-[10px] text-[#777777] text-center py-6 leading-relaxed">
                  Clique em um elemento para editar suas propriedades
                </p>
              )}

              {/* Layers */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-wider flex items-center gap-1 border-b border-[#1b1b1b] pb-1.5">
                  <LayersIcon className="w-3 h-3" /> Camadas
                </p>
                <div className="space-y-0.5 max-h-56 overflow-y-auto">
                  {layers.length === 0 && (
                    <p className="text-[10px] text-[#777777] text-center py-3">Nenhum elemento ainda</p>
                  )}
                  {layers.map((obj: any, i: number) => {
                    const bg = isBg(obj);
                    const text = isText(obj);
                    const isActive = selected === obj;
                    const isImage = obj.type === "image";
                    const Icon = bg ? ImageIcon : text ? Type : isImage ? ImageIcon
                      : obj.type === "circle" ? CircleIcon
                      : obj.type === "line" ? Slash
                      : obj.type === "triangle" ? TriangleIcon
                      : Square;
                    const label = bg
                      ? "Imagem de fundo"
                      : text
                      ? (obj.text?.trim()?.slice(0, 22) || "Texto")
                      : isImage ? "Imagem"
                      : obj.type === "circle" ? "Círculo"
                      : obj.type === "line" ? "Linha"
                      : obj.type === "triangle" ? "Triângulo"
                      : "Retângulo";
                    const hidden = obj.visible === false;
                    const isDragging = dragLayerIdx === i;
                    const showDropAbove = dragOverLayerIdx === i && dragLayerIdx !== null && dragLayerIdx !== i;
                    return (
                      <div key={i}
                        draggable={!bg}
                        onDragStart={(e) => {
                          setDragLayerIdx(i);
                          e.dataTransfer.effectAllowed = "move";
                          // Firefox só ativa o drag se algum dado for setado.
                          e.dataTransfer.setData("text/plain", String(i));
                        }}
                        onDragOver={(e) => {
                          if (bg || dragLayerIdx === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverLayerIdx !== i) setDragOverLayerIdx(i);
                        }}
                        onDragLeave={() => setDragOverLayerIdx((cur) => (cur === i ? null : cur))}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragLayerIdx !== null && !bg) reorderLayer(dragLayerIdx, i);
                          setDragLayerIdx(null);
                          setDragOverLayerIdx(null);
                        }}
                        onDragEnd={() => { setDragLayerIdx(null); setDragOverLayerIdx(null); }}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-1 rounded-[3px] border transition-colors",
                          isActive ? "border-[#0c8ce9]/60 bg-[#0c8ce9]/10" : "border-transparent hover:bg-[#3a3a3a]",
                          isDragging && "opacity-40",
                          showDropAbove && "border-t-2 border-t-[#0c8ce9]"
                        )}
                      >
                        {bg ? (
                          <span className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <GripVertical className="w-3.5 h-3.5 shrink-0 text-[#666666] cursor-grab active:cursor-grabbing" />
                        )}
                        <button onClick={() => selectLayer(obj)} disabled={bg}
                          className="flex-1 flex items-center gap-1.5 min-w-0 text-left disabled:cursor-default">
                          <Icon className={cn("w-3.5 h-3.5 shrink-0", hidden ? "text-[#555555]" : "text-[#999999]")} />
                          <span className={cn("text-[11px] truncate text-[#cccccc]", hidden && "text-[#666666]")}>{label}</span>
                          {bg && <Lock className="w-3 h-3 shrink-0 text-[#666666]" />}
                        </button>
                        <button onClick={() => toggleLayerVisibility(obj)} title={hidden ? "Mostrar" : "Ocultar"}
                          className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-[#999999] hover:bg-[#4a4a4a] hover:text-white transition-colors">
                          {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {!bg && (
                          <>
                            <button onClick={() => moveLayer(obj, 1)} title="Subir"
                              className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-[#999999] hover:bg-[#4a4a4a] hover:text-white transition-colors">
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => moveLayer(obj, -1)} title="Descer"
                              className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-[#999999] hover:bg-[#4a4a4a] hover:text-white transition-colors">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteLayer(obj)} title="Excluir"
                              className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-[#999999] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Elementos — upload de imagem solta na arte (logo, foto etc.) */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-wider flex items-center gap-1 border-b border-[#1b1b1b] pb-1.5">
                  <Upload className="w-3 h-3" /> Elementos
                </p>
                <input ref={elementImageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageElement(f); e.target.value = ""; }} />
                <button onClick={() => elementImageInputRef.current?.click()}
                  className="w-full h-16 rounded-[3px] border border-dashed border-[#5a5a5a] flex flex-col items-center justify-center gap-1 text-[#999999] hover:bg-[#3a3a3a] hover:border-[#0c8ce9]/60 hover:text-white transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[10px]">Enviar imagem</span>
                </button>
              </div>

              {/* Color palette */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-wider border-b border-[#1b1b1b] pb-1.5">Paleta</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {PALETTE.map((c) => (
                    <button key={c} title={c}
                      onClick={() => applyColor(c)}
                      className="h-9 w-full rounded-[3px] border border-[#1b1b1b] hover:scale-110 hover:border-[#0c8ce9]/60 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Background color */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-wider border-b border-[#1b1b1b] pb-1.5">Cor de fundo</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {["#1a1a2e", "#0d0d0d", "#ffffff", "#f5f5f0", "#0a1628", "#1e3a5f", "#2d1b69", "#4a0e0e", "#0e4a1e", "#2a2a2a"].map((c) => (
                    <button key={c} title={c}
                      onClick={() => { setCanvasBgColor(c); fabricRef.current?.set("backgroundColor", c); fabricRef.current?.renderAll(); }}
                      className="h-9 w-full rounded-[3px] border border-[#1b1b1b] hover:scale-110 hover:border-[#0c8ce9]/60 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
