import { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, MapPin } from "lucide-react";
import { getCurrentPosition } from "../lib/geoLocation";
import { drawWatermarkOnCanvas } from "../lib/mediaWatermark";

export default function LiveCameraCapture({
  open,
  onClose,
  onCapture,
  title = "Photo sur le chantier",
  watermarkMeta = {},
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geo, setGeo] = useState(null);
  const [geoStatus, setGeoStatus] = useState("pending");

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      setReady(false);
      setError("");
      setGeo(null);
      setGeoStatus("pending");
      return undefined;
    }

    let cancelled = false;
    setError("");
    setReady(false);
    setGeoStatus("pending");

    getCurrentPosition().then((pos) => {
      if (cancelled) return;
      setGeo(pos);
      setGeoStatus(pos ? "ok" : "unavailable");
    });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Caméra non disponible. Utilisez le bouton « Appareil photo » sur mobile.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch (e) {
        const name = e?.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError("Autorisez l'accès à la caméra pour prendre une photo en direct.");
        } else {
          setError("Impossible d'ouvrir la caméra. Essayez sur téléphone ou autorisez la caméra.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facing]);

  const buildMeta = () => ({
    ...watermarkMeta,
    latitude: geo?.latitude ?? watermarkMeta.latitude,
    longitude: geo?.longitude ?? watermarkMeta.longitude,
    capturedAt: new Date(),
  });

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || saving) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, buildMeta());

    setSaving(true);
    setError("");

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setSaving(false);
          return;
        }
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const file = new File([blob], `photo_chantier_${ts}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        try {
          await onCapture(file, buildMeta());
          stopStream();
          onClose();
        } catch (e) {
          setError(e?.message || "Échec de l'enregistrement. Réessayez.");
          setSaving(false);
        }
      },
      "image/jpeg",
      0.92
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black flex flex-col text-white"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Prise de vue directe</p>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-[10px] text-emerald-300 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {geoStatus === "pending" && "Localisation…"}
            {geoStatus === "ok" && "Filigrane date + chantier + GPS"}
            {geoStatus === "unavailable" && "Filigrane date + chantier (GPS indisponible)"}
          </p>
        </div>
        <button type="button" onClick={() => { stopStream(); onClose(); }} className="p-2 rounded-lg hover:bg-white/10">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative bg-black min-h-0 flex items-center justify-center">
        {error ? (
          <p className="text-center text-red-300 px-6 text-sm max-w-md">{error}</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover max-h-[70vh]"
          />
        )}
        {saving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-sm font-medium">Enregistrement sur le chantier…</p>
          </div>
        )}
        {ready && !saving && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-xs bg-black/50 px-3 py-1 rounded-full">
              Filigrane appliqué à la capture
            </span>
          </div>
        )}
      </div>

      <div className="p-4 bg-black/90 flex flex-wrap items-center justify-center gap-4 shrink-0">
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/30 text-sm hover:bg-white/10"
          disabled={!!error}
        >
          <RefreshCw className="w-4 h-4" /> Retourner
        </button>
        <button
          type="button"
          onClick={takePhoto}
          disabled={!ready || !!error || saving}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm disabled:opacity-40"
        >
          <Camera className="w-5 h-5" /> {saving ? "Enregistrement…" : "Capturer & enregistrer"}
        </button>
      </div>
    </div>
  );
}
