import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  MousePointer2, Type, Square, Circle as CircleIcon,
  Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Save, X, Minus, Plus, ChevronUp, ChevronDown,
  Image as ImageIcon,
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

// ── Types ─────────────────────────────────────────────────────────────────────

type Tool = "select" | "text" | "rect" | "circle";

// Selected object type guard
function isText(obj: any) {
  return obj?.type === "i-text" || obj?.type === "textbox";
}
function isShape(obj: any) {
  return obj && !isText(obj) && obj.name !== "__bg__";
}

export interface DesignEditorProps {
  open: boolean;
  onClose: () => void;
  initialImageUrl?: string | null;
  onSave: (dataUrl: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function DesignEditor({ open, onClose, initialImageUrl, onSave }: DesignEditorProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);

  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<any>(null);

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

  // ── Fabric init ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    injectGoogleFonts();

    let canvas: any;
    let disposed = false;

    (async () => {
      const { Canvas, FabricImage } = await import("fabric");
      if (disposed || !canvasElRef.current) return;

      canvas = new Canvas(canvasElRef.current, {
        width: 540,
        height: 675,
        backgroundColor: "#111111",
        preserveObjectStacking: true,
      });
      fabricRef.current = canvas;
      historyRef.current = [];
      historyIdxRef.current = -1;

      // Background image
      if (initialImageUrl) {
        try {
          let src = initialImageUrl;
          if (/^https?:\/\//i.test(initialImageUrl)) {
            src = `/api/image-proxy?url=${encodeURIComponent(initialImageUrl)}`;
          }
          const img = await FabricImage.fromURL(src);
          if (img.width && img.height) {
            const scale = Math.max(540 / img.width, 675 / img.height);
            img.set({
              scaleX: scale, scaleY: scale,
              left: (540 - img.width * scale) / 2,
              top: (675 - img.height * scale) / 2,
              selectable: false, evented: false,
              name: "__bg__",
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
      canvas.on("object:added", saveHistory);
      canvas.on("object:modified", saveHistory);
      canvas.on("object:removed", saveHistory);

      canvas.renderAll();
    })();

    return () => {
      disposed = true;
      if (canvas) { canvas.dispose(); fabricRef.current = null; }
    };
  }, [open, initialImageUrl]);

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
    } else if (isShape(obj)) {
      setShapeColor(typeof obj.fill === "string" ? obj.fill : "#00bcd4");
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
    const text = new IText("Seu texto aqui", {
      left: 80, top: canvas.height / 2 - 30,
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
      radius: 80,
      fill: shapeColor,
      opacity: shapeOpacity / 100,
    } as any);
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    setTool("select");
  }, [shapeColor, shapeOpacity]);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && obj.name !== "__bg__") {
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
    canvas.loadFromJSON(state).then(() => canvas.renderAll());
  }, []);

  const layerUp = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (obj) { canvas.bringObjectForward(obj); canvas.renderAll(); }
  }, []);

  const layerDown = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (obj && obj.name !== "__bg__") { canvas.sendObjectBackwards(obj); canvas.renderAll(); }
  }, []);

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
      const scale = Math.max(540 / img.width!, 675 / img.height!);
      img.set({
        scaleX: scale, scaleY: scale,
        left: (540 - img.width! * scale) / 2,
        top: (675 - img.height! * scale) / 2,
        selectable: false, evented: false, name: "__bg__",
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
      onSave(dataUrl);
      toast.success("Design aplicado ao slide!");
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
    else if (isShape(obj)) { setShapeColor(color); applyProp("fill", color); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const textSel = isText(selected);
  const shapeSel = isShape(selected);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="!max-w-[95vw] !w-[95vw] !h-[95vh] p-0 !flex flex-col overflow-hidden !gap-0 [&>button]:hidden"
        style={{ maxWidth: "95vw", width: "95vw", height: "95vh" }}
      >

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-background shrink-0">
          <span className="font-semibold text-sm">Editor de Design</span>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-3.5 h-3.5" /> Trocar fundo
            </Button>
            <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" /> Salvar no slide
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left toolbar */}
          <div className="w-14 border-r border-border/40 flex flex-col items-center gap-1 py-3 bg-muted/10 shrink-0">
            {([
              { id: "select" as Tool, Icon: MousePointer2, label: "Selecionar", action: () => setTool("select") },
              { id: "text" as Tool, Icon: Type, label: "Texto", action: () => { setTool("text"); addText(); } },
              { id: "rect" as Tool, Icon: Square, label: "Retângulo", action: () => { setTool("rect"); addRect(); } },
              { id: "circle" as Tool, Icon: CircleIcon, label: "Círculo", action: () => { setTool("circle"); addCircle(); } },
            ]).map(({ id, Icon, label, action }) => (
              <button key={id} title={label} onClick={action}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  tool === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                <Icon className="w-4 h-4" />
              </button>
            ))}

            <div className="w-8 border-t border-border/30 my-1" />

            <button title="Subir camada" onClick={layerUp} disabled={!selected}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button title="Descer camada" onClick={layerDown} disabled={!selected}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>

            <div className="mt-auto">
              <button title="Desfazer" onClick={undo}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-[10px] font-bold">
                ↩
              </button>
              <button title="Excluir" onClick={deleteSelected} disabled={!selected || selected?.name === "__bg__"}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas workspace */}
          <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden">
            <div className="shadow-2xl rounded-lg overflow-hidden" style={{ width: 540, height: 675 }}>
              <canvas ref={canvasElRef} />
            </div>
          </div>

          {/* Right properties */}
          <div className="w-64 border-l border-border/40 bg-background overflow-y-auto shrink-0">
            <div className="p-3 space-y-4">

              {/* Text properties */}
              {(textSel || tool === "text") && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Texto</p>

                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Fonte</label>
                    <select
                      className="w-full h-8 rounded-md border border-border/40 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                      value={fontFamily}
                      style={{ fontFamily }}
                      onChange={(e) => { setFontFamily(e.target.value); applyProp("fontFamily", e.target.value); }}
                    >
                      {DESIGN_FONTS.map((f) => (
                        <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Tamanho</label>
                    <div className="flex items-center gap-1">
                      <button className="h-7 w-7 rounded border border-border/40 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        onClick={() => { const s = Math.max(8, fontSize - 2); setFontSize(s); applyProp("fontSize", s); }}>
                        <Minus className="w-3 h-3" />
                      </button>
                      <input type="number" className="flex-1 h-7 rounded border border-border/40 bg-background text-center text-xs focus:outline-none"
                        value={fontSize}
                        onChange={(e) => { const s = Number(e.target.value); setFontSize(s); applyProp("fontSize", s); }} />
                      <button className="h-7 w-7 rounded border border-border/40 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        onClick={() => { const s = fontSize + 2; setFontSize(s); applyProp("fontSize", s); }}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Cor do texto</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="h-8 w-10 rounded border border-border/40 p-0.5 cursor-pointer bg-background"
                        value={textColor} onChange={(e) => { setTextColor(e.target.value); applyProp("fill", e.target.value); }} />
                      <input className="flex-1 h-8 rounded border border-border/40 bg-background px-2 text-xs uppercase font-mono focus:outline-none"
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
                        className={cn("h-7 w-7 rounded border border-border/40 flex items-center justify-center transition-colors",
                          state ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted")}>
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                    <div className="flex-1" />
                    {(["left", "center", "right"] as const).map((a, i) => {
                      const Icon = [AlignLeft, AlignCenter, AlignRight][i];
                      return (
                        <button key={a} onClick={() => { setAlign(a); applyProp("textAlign", a); }}
                          className={cn("h-7 w-7 rounded border border-border/40 flex items-center justify-center transition-colors",
                            align === a ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted")}>
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
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Forma</p>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Cor</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="h-8 w-10 rounded border border-border/40 p-0.5 cursor-pointer bg-background"
                        value={shapeColor} onChange={(e) => { setShapeColor(e.target.value); applyProp("fill", e.target.value); }} />
                      <input className="flex-1 h-8 rounded border border-border/40 bg-background px-2 text-xs uppercase font-mono focus:outline-none"
                        value={shapeColor} onChange={(e) => { setShapeColor(e.target.value); applyProp("fill", e.target.value); }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Opacidade: {shapeOpacity}%</label>
                    <input type="range" min={10} max={100} step={5} className="w-full accent-primary"
                      value={shapeOpacity} onChange={(e) => { const v = Number(e.target.value); setShapeOpacity(v); applyProp("opacity", v / 100); }} />
                  </div>
                </div>
              )}

              {!selected && tool === "select" && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-6 leading-relaxed">
                  Clique em um elemento para editar suas propriedades
                </p>
              )}

              {/* Color palette */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Paleta</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {PALETTE.map((c) => (
                    <button key={c} title={c}
                      onClick={() => applyColor(c)}
                      className="h-9 w-full rounded-md border border-border/20 hover:scale-110 hover:border-primary/50 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Background color */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cor de fundo</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {["#1a1a2e", "#0d0d0d", "#ffffff", "#f5f5f0", "#0a1628", "#1e3a5f", "#2d1b69", "#4a0e0e", "#0e4a1e", "#2a2a2a"].map((c) => (
                    <button key={c} title={c}
                      onClick={() => { fabricRef.current?.set("backgroundColor", c); fabricRef.current?.renderAll(); }}
                      className="h-9 w-full rounded-md border border-border/20 hover:scale-110 hover:border-primary/50 transition-transform"
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
