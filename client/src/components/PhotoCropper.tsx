import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const VIEW = 288; // tamanho da área de recorte na tela (px)
const OUT = 512; // tamanho da foto final (px)
const MAX_ZOOM = 4;

/**
 * Ajuste da foto de perfil: arrastar para posicionar, zoom pela barra ou pela
 * rodinha do mouse (ou pinça no celular). Devolve um JPEG quadrado 512×512.
 */
export function PhotoCropper({ src, open, onCancel, onDone, onError }: { src: string | null; open: boolean; onCancel: () => void; onDone: (dataUrl: string) => void; onError?: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // deslocamento do centro da foto, em px da tela
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    if (!src) return;
    const el = new Image();
    // Foto já salva (link do storage): precisa de CORS para poder ser recortada no canvas.
    if (/^https?:/.test(src)) el.crossOrigin = "anonymous";
    el.onload = () => { setImg(el); setZoom(1); setPos({ x: 0, y: 0 }); };
    el.onerror = () => onError?.();
    el.src = src;
  }, [src]);

  // Escala que faz a foto cobrir o quadrado inteiro com zoom 1.
  const base = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : VIEW;
  const h = img ? img.naturalHeight * base * zoom : VIEW;

  /** Não deixa sobrar espaço vazio dentro do quadrado. */
  const clamp = (p: { x: number; y: number }, ww = w, hh = h) => ({
    x: Math.max(-(ww - VIEW) / 2, Math.min((ww - VIEW) / 2, p.x)),
    y: Math.max(-(hh - VIEW) / 2, Math.min((hh - VIEW) / 2, p.y)),
  });

  const applyZoom = (z: number) => {
    const next = Math.max(1, Math.min(MAX_ZOOM, z));
    if (!img) return setZoom(next);
    const ratio = next / zoom;
    setZoom(next);
    setPos((p) => clamp({ x: p.x * ratio, y: p.y * ratio }, img.naturalWidth * base * next, img.naturalHeight * base * next));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      applyZoom(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
    } else if (drag.current) {
      setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
  };

  const confirm = () => {
    if (!img) return;
    const k = OUT / VIEW;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (VIEW / 2 + pos.x - w / 2) * k, (VIEW / 2 + pos.y - h / 2) * k, w * k, h * k);
    try { onDone(canvas.toDataURL("image/jpeg", 0.92)); } catch { onError?.(); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription>Arraste para posicionar e use o zoom para encaixar o rosto no círculo.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-muted active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            onWheel={(e) => applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          >
            {img && (
              <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
                style={{ width: w, height: h, left: VIEW / 2 + pos.x - w / 2, top: VIEW / 2 + pos.y - h / 2 }} />
            )}
            {/* máscara: escurece fora do círculo, como a foto vai aparecer */}
            <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 ${VIEW}px rgba(0,0,0,0.55)` }} />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />
          </div>

          <div className="flex w-full max-w-[288px] items-center gap-3">
            <button type="button" onClick={() => applyZoom(zoom - 0.2)} aria-label="Diminuir zoom" className="rounded-full p-1 text-muted-foreground hover:bg-muted"><ZoomOut className="h-4 w-4" /></button>
            <Slider value={[zoom]} min={1} max={MAX_ZOOM} step={0.01} onValueChange={([z]) => applyZoom(z)} aria-label="Zoom" />
            <button type="button" onClick={() => applyZoom(zoom + 0.2)} aria-label="Aumentar zoom" className="rounded-full p-1 text-muted-foreground hover:bg-muted"><ZoomIn className="h-4 w-4" /></button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Recomeçar</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="button" onClick={confirm} disabled={!img}>Usar esta foto</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
