import { useRef, useEffect, useCallback } from "react";
import { Eraser } from "lucide-react";

export default function SignaturePad({ value, onChange, className = "" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  };

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const saved = value || canvas.toDataURL();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (saved && saved !== "data:,") {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = saved;
    }
  }, [value]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const pos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = getCtx();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = getCtx();
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange?.(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange?.("");
  };

  return (
    <div className={className}>
      <div className="relative rounded-lg border border-gray-200 dark:border-gray-600 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-28 touch-none cursor-crosshair block"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
        <button
          type="button"
          onClick={clear}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs flex items-center gap-1"
          title="Effacer la signature"
        >
          <Eraser className="w-3.5 h-3.5" /> Effacer
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1">Signez avec la souris ou le doigt — apparaît sur le PDF</p>
    </div>
  );
}
