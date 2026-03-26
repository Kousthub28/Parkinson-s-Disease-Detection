import { AlertCircle, Camera, ScanLine } from 'lucide-react';

interface TherapyCameraProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraReady: boolean;
  loading: boolean;
  error: string | null;
  personDetected: boolean;
  currentStatus: string;
}

const TherapyCamera = ({
  videoRef,
  canvasRef,
  cameraReady,
  loading,
  error,
  personDetected,
  currentStatus,
}: TherapyCameraProps) => (
  <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-[#1F2821] shadow-2xl">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(211,161,93,0.22),transparent_45%),linear-gradient(145deg,rgba(40,52,42,0.95),rgba(18,24,20,0.98))]" />
    <div className="relative aspect-[4/3]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transition-opacity duration-500 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ transform: 'scaleX(-1)' }}
      />

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
        <ScanLine className="h-4 w-4 text-[#D3A15D]" />
        <span>{currentStatus}</span>
      </div>

      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${personDetected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span>{personDetected ? 'Person detected' : 'Waiting for pose'}</span>
      </div>

      {(loading || !cameraReady || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1A221C]/75 backdrop-blur-sm">
          <div className="max-w-sm px-6 text-center text-white">
            {error ? (
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-[#E79A83]" />
            ) : (
              <Camera className="mx-auto mb-4 h-12 w-12 animate-pulse text-[#D3A15D]" />
            )}
            <p className="text-lg font-semibold">{error ? 'Camera or model issue' : 'Preparing live tracking'}</p>
            <p className="mt-2 text-sm text-white/75">
              {error ?? 'Allow camera access and stay in frame while the pose model initializes.'}
            </p>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default TherapyCamera;
