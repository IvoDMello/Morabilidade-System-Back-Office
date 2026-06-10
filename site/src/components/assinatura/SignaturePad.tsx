"use client";

import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  toDataURL: () => string | null;
  isEmpty: () => boolean;
  clear: () => void;
}

interface Props {
  /** Chamado quando o usuário começa/para de desenhar (para habilitar o botão). */
  onInkChange?: (hasInk: boolean) => void;
  label?: string;
}

/** Quadro de assinatura à mão (dedo/mouse), em alta resolução. Compartilhado
 * pela ficha de visita e pela autorização de intermediação. */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  function SignaturePad({ onInkChange, label = "Sua assinatura *" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const desenhando = useRef(false);
    const ultimo = useRef<{ x: number; y: number } | null>(null);
    const [temTraco, setTemTraco] = useState(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#1f2937";
      }
    }, []);

    function marcarTraco() {
      if (!temTraco) {
        setTemTraco(true);
        onInkChange?.(true);
      }
    }

    function limpar() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTemTraco(false);
      onInkChange?.(false);
    }

    useImperativeHandle(ref, () => ({
      toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? null,
      isEmpty: () => !temTraco,
      clear: limpar,
    }), [temTraco]);

    function pos(e: React.PointerEvent<HTMLCanvasElement>) {
      const r = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-600">{label}</label>
          <button type="button" onClick={limpar} className="text-xs text-[#7a7c72] hover:text-slate-700 flex items-center gap-1">
            <Eraser className="w-3 h-3" /> Limpar
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            desenhando.current = true;
            ultimo.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!desenhando.current) return;
            e.preventDefault();
            const ctx = canvasRef.current?.getContext("2d");
            if (!ctx || !ultimo.current) return;
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(ultimo.current.x, ultimo.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ultimo.current = p;
            marcarTraco();
          }}
          onPointerUp={() => { desenhando.current = false; ultimo.current = null; }}
          onPointerLeave={() => { desenhando.current = false; ultimo.current = null; }}
          className="w-full h-40 rounded-lg border border-dashed border-slate-300 bg-slate-50"
          style={{ touchAction: "none" }}
        />
        <p className="text-[11px] text-[#7a7c72] mt-1">Assine com o dedo ou o mouse no quadro acima.</p>
      </div>
    );
  },
);
