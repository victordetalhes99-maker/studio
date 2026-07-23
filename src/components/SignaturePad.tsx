import { useEffect, useRef, useState } from "react";

interface Props {
  value?: string;
  onChange: (dataUrl: string | null) => void;
}

/**
 * Normaliza o conteúdo de um canvas de assinatura para o formato que vai ao
 * contrato/PDF: traço preto sólido (#000) sobre fundo transparente, com auto
 * crop dos espaços vazios e margem de segurança. Preserva a proporção original
 * do desenho — não estica, não deforma, não inverte.
 *
 * Retorna `null` quando o canvas está efetivamente vazio (nenhum pixel
 * desenhado), permitindo bloquear o envio de assinaturas em branco.
 */
function normalizeSignatureForDocument(source: HTMLCanvasElement): string | null {
  const w = source.width;
  const h = source.height;
  if (!w || !h) return null;
  const srcCtx = source.getContext("2d");
  if (!srcCtx) return null;

  const img = srcCtx.getImageData(0, 0, w, h);
  const data = img.data;

  // 1) Detecta bounding box dos pixels realmente desenhados (alpha > limiar).
  const ALPHA_MIN = 24; // ignora anti-aliasing fantasma
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let inkPixels = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a >= ALPHA_MIN) {
        inkPixels++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Precisa ter conteúdo real (não um traço acidental de 3-4 pixels).
  if (inkPixels < 12 || maxX < 0) return null;

  // 2) Recolore cada pixel do traço para preto sólido, preserva alpha.
  //    Zera qualquer pixel abaixo do limiar (remove ruído fantasma).
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a >= ALPHA_MIN) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      // mantém alpha para preservar suavidade do traço
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }

  // 3) Recorta com margem de segurança proporcional ao tamanho do desenho.
  const pad = Math.max(12, Math.round(Math.max(maxX - minX, maxY - minY) * 0.06));
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w, maxX + pad) - cropX;
  const cropH = Math.min(h, maxY + pad) - cropY;

  // Canvas temporário do tamanho original para receber os pixels recoloridos,
  // depois copiamos apenas a região recortada para o canvas final.
  const stage = document.createElement("canvas");
  stage.width = w;
  stage.height = h;
  const stageCtx = stage.getContext("2d");
  if (!stageCtx) return null;
  stageCtx.putImageData(img, 0, 0);

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;
  outCtx.drawImage(stage, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return out.toDataURL("image/png");
}

export function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      // Cor visual clara apenas para o cliente enxergar na UI escura.
      // A cor final do contrato/PDF é gerada por normalizeSignatureForDocument
      // e NÃO depende deste strokeStyle.
      ctx.strokeStyle = "#f5e6b8";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    // Gera a versão preta/transparente já recortada e proporcional.
    const normalized = normalizeSignatureForDocument(canvasRef.current!);
    if (normalized) {
      onChange(normalized);
    } else {
      // Traço insignificante: trata como canvas vazio.
      setHasInk(false);
      onChange(null);
    }
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl overflow-hidden relative">
        <canvas
          ref={canvasRef}
          className="w-full h-56 sm:h-64 touch-none cursor-crosshair block"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasInk && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground text-sm tracking-wide">
              Assine aqui usando o dedo ou o mouse
            </span>
          </div>
        )}
        <div className="absolute bottom-3 left-4 right-4 border-b border-dashed border-gold/30" />
      </div>
      <button
        type="button"
        onClick={clear}
        className="text-xs text-muted-foreground hover:text-gold transition-colors uppercase tracking-widest"
      >
        Limpar assinatura
      </button>
    </div>
  );
}
