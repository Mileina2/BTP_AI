import { useEffect, useRef, useState } from "react";
import { Video, X, RefreshCw, Square, Circle, MapPin } from "lucide-react";
import { getCurrentPosition } from "../lib/geoLocation";
import { drawWatermarkOnCanvas } from "../lib/mediaWatermark";

const MAX_SECONDS = 120;

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function formatTimer(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function LiveVideoCapture({
  open,
  onClose,
  onCapture,
  title = "Vidéo sur le chantier",
  watermarkMeta = {},
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const captureMetaRef = useRef(null);

  const [error, setError] = useState("");
  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [geo, setGeo] = useState(null);
  const [geoStatus, setGeoStatus] = useState("pending");

  const stopDrawLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopStream = () => {
    stopDrawLoop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    canvasRef.current = null;
    setRecording(false);
    setElapsed(0);
  };

  const buildMeta = () => ({
    ...watermarkMeta,
    latitude: geo?.latitude ?? watermarkMeta.latitude,
    longitude: geo?.longitude ?? watermarkMeta.longitude,
    capturedAt: new Date(),
  });

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
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
          setError("Enregistrement vidéo non disponible. Utilisez « Vidéo mobile » sur téléphone.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          await video.play();
          setReady(true);
        }
      } catch (e) {
        const name = e?.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError("Autorisez la caméra et le micro pour filmer en direct.");
        } else {
          setError("Impossible d'ouvrir la caméra pour la vidéo.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facing]);

  const finishRecording = async () => {
    stopDrawLoop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    canvasRef.current = null;

    const mime = pickMimeType() || "video/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];
    if (blob.size < 1000) {
      setError("Vidéo trop courte. Réessayez.");
      setReady(false);
      return;
    }
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = new File([blob], `video_chantier_${ts}.${ext}`, { type: mime, lastModified: Date.now() });
    setSaving(true);
    setError("");
    try {
      await onCapture(file, captureMetaRef.current || buildMeta());
      onClose();
    } catch (e) {
      setError(e?.message || "Échec de l'enregistrement. Réessayez.");
      setSaving(false);
    }
  };

  const startRecording = () => {
    if (!streamRef.current || recording) return;
    const mime = pickMimeType();
    if (!mime) {
      setError("Enregistrement vidéo non supporté par ce navigateur.");
      return;
    }

    const video = videoRef.current;
    if (!video?.videoWidth) {
      setError("Caméra non prête. Réessayez.");
      return;
    }

    captureMetaRef.current = buildMeta();
    const meta = captureMetaRef.current;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");

    const drawFrame = () => {
      if (!streamRef.current || !canvasRef.current) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, meta);
      rafRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const canvasStream = canvas.captureStream(24);
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);

    chunksRef.current = [];
    const recorder = new MediaRecorder(canvasStream, { mimeType: mime });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = finishRecording;
    recorder.start(1000);
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= MAX_SECONDS) {
          stopRecording();
          return MAX_SECONDS;
        }
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (!recording || !recorderRef.current) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    recorderRef.current.stop();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col text-white" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Enregistrement direct</p>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-[10px] text-emerald-300 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {geoStatus === "pending" && "Localisation…"}
            {geoStatus === "ok" && "Filigrane gravé dans la vidéo + GPS"}
            {geoStatus === "unavailable" && "Filigrane gravé (GPS indisponible)"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { stopStream(); onClose(); }}
          className="p-2 rounded-lg hover:bg-white/10"
          disabled={recording}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative bg-black min-h-0 flex items-center justify-center">
        {error ? (
          <p className="text-center text-red-300 px-6 text-sm max-w-md">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover max-h-[70vh]" />
        )}
        {recording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
            <Circle className="w-3 h-3 fill-white" /> REC {formatTimer(elapsed)} / {formatTimer(MAX_SECONDS)}
          </div>
        )}
        {ready && !recording && !saving && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-xs bg-black/50 px-3 py-1 rounded-full">
              Filigrane date/chantier/GPS sur toute la vidéo
            </span>
          </div>
        )}
        {saving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-sm font-medium">Enregistrement sur le chantier…</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-black/90 flex flex-wrap items-center justify-center gap-4 shrink-0">
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/30 text-sm hover:bg-white/10"
          disabled={!!error || recording}
        >
          <RefreshCw className="w-4 h-4" /> Retourner
        </button>
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={!ready || !!error}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-sm disabled:opacity-40"
          >
            <Video className="w-5 h-5" /> Démarrer
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-black font-bold text-sm disabled:opacity-40"
          >
            <Square className="w-5 h-5 fill-current" /> {saving ? "Enregistrement…" : "Arrêter & enregistrer"}
          </button>
        )}
      </div>
    </div>
  );
}
