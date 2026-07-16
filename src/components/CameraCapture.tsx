import { useRef, useState, useEffect, useCallback } from 'react';

interface Props {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  onGallery?: () => void;
}

export function CameraCapture({ onCapture, onClose, onGallery }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not available on this device. Please use gallery upload.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      setLoading(true);
      stream?.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setError('Camera access denied. Please allow camera permissions or use gallery upload.');
    } finally {
      setLoading(false);
    }
  }, [stream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        stream?.getTracks().forEach((t) => t.stop());
        onCapture(blob);
      }
    }, 'image/jpeg', 0.85);
  };

  const showError = error && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          {loading && !error && (
            <div className="flex flex-col items-center gap-2 text-white/70">
              <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Starting camera...</span>
            </div>
          )}
          {showError ? (
            <div className="flex flex-col items-center gap-3 text-white px-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <p className="text-sm text-center">{error}</p>
            </div>
          ) : (
            !loading && <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="p-4 flex items-center justify-between">
          {showError ? (
            <>
              <button onClick={onClose} className="text-xs text-steel hover:text-charcoal transition-colors cursor-pointer">
                Cancel
              </button>
              {onGallery && (
                <button onClick={onGallery} className="text-xs font-semibold text-bronze hover:text-bronze/80 transition-colors cursor-pointer">
                  Use Gallery Instead
                </button>
              )}
              <button onClick={() => startCamera(facingMode)} className="text-xs text-steel hover:text-charcoal transition-colors cursor-pointer">
                Retry
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                className="text-xs text-steel hover:text-charcoal transition-colors cursor-pointer flex items-center gap-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Flip
              </button>
              <button
                onClick={capture}
                className="w-14 h-14 rounded-full border-4 border-white bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white" />
              </button>
              <button onClick={onClose} className="text-xs text-steel hover:text-charcoal transition-colors cursor-pointer">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
