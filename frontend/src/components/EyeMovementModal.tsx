import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Eye, LoaderCircle, ScanLine, Square, Video, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { insertTestRecord } from '../services/testPersistence';
import {
  EyeMovementApiError,
  predictEyeMovement,
  type EyeMovementDebugPayload,
  type EyeMovementIssueFrame,
  type EyeMovementPrediction,
} from '../services/eyeMovementModel';

const TEST_DURATION_SECONDS = 20;
const MIN_RELIABLE_ANALYZED_FRAMES = 30;
const MIN_RELIABLE_TRACKED_FRAMES = 30;
const MIN_RELIABLE_DURATION_SECONDS = 8;
const GENERIC_GAZE_ISSUE = 'Large gaze deviation from guided target';

const englishCopy = {
  badge: 'Eye Movement Screening',
  title: '20-second guided eye test',
  description:
    'Keep your head still and follow the moving dot using only your eyes. The system records a 20-second webcam clip and analyzes gaze shifts, blinking, fixation, and tracking smoothness.',
  stepsTitle: 'Before you start',
  steps: [
    'Sit about an arm\'s length from the screen.',
    'Keep your face centered and your head as still as possible.',
    'Use a calm room with even lighting and no strong glare.',
    'Follow the moving dot with only your eyes for the full 20 seconds.',
  ],
  protocolTitle: 'Protocol',
  protocolBody: 'Center, left, right, center, up, down, smooth sweep right, smooth sweep left, then center.',
  liveCamera: 'Live camera preview',
  faceHint: 'Keep both eyes inside the oval guide and move a little closer if your face looks small.',
  cameraLive: 'Camera live',
  ready: 'Ready to record',
  recording: 'Recording in progress',
  secondsLeft: (value: number) => `${value.toFixed(1)}s remaining`,
  start: 'Start 20-second test',
  stop: 'Stop now',
  uploading: 'Uploading guided eye sample...',
  saving: 'Saving result...',
  cameraPreparing: 'Preparing camera...',
  noCamera: 'Camera access was denied. Please allow webcam permission and try again.',
  unsupported: 'This browser does not support video recording for the eye-movement test.',
  confidence: 'Confidence',
  quality: 'Signal quality',
  explanation: 'Clinical summary',
  diagnosticsTitle: 'Tracking diagnostics',
  diagnosticsReason: 'Reason',
  diagnosticsFrames: 'Most problematic frames',
  liveStatus: 'Live status',
  liveStatusHint: 'Guide, live face video, and status stay aligned on one row for easier testing.',
  stage: 'Stage',
  protocolRunning: 'Protocol running',
  saved: 'Saved to dashboard',
  savedLocal: 'Saved locally',
  done: 'Done',
  retake: 'Run again',
  trackedFrames: 'Tracked frames',
  usableDuration: 'Usable duration',
  qualityScore: 'Quality score',
  protocolCompliance: 'Protocol match',
  metrics: {
    saccade: 'Saccadic speed',
    smoothness: 'Tracking smoothness',
    blinkRate: 'Blink rate',
    fixation: 'Fixation drift',
    response: 'Response delay',
  },
  diagnosticsCounts: {
    total: 'Total sampled frames',
    analyzed: 'Analyzed frames',
    tracked: 'Tracked eye frames',
    faceMissing: 'Face missing frames',
    eyeFail: 'Eye geometry failed frames',
  },
} as const;

const eyeMovementCopy = {
  en: englishCopy,
  kn: englishCopy,
} as const;

type AppCopy = typeof englishCopy;

const formatPhaseName = (phase?: string) => {
  if (!phase) return '';
  return phase.replace(/_/g, ' ');
};

const getPhaseIssueLabel = (phase?: string) => {
  switch (phase) {
    case 'left_hold':
      return 'Missed the left hold target';
    case 'right_hold':
      return 'Missed the right hold target';
    case 'up_hold':
      return 'Missed the upward hold target';
    case 'down_hold':
      return 'Missed the downward hold target';
    case 'center_start':
      return 'Eyes drifted away from the opening center hold';
    case 'center_reset':
      return 'Eyes drifted during the center reset';
    case 'center_finish':
      return 'Eyes drifted during the final center hold';
    case 'sweep_right':
      return 'Tracking lagged during the right sweep';
    case 'sweep_left':
      return 'Tracking lagged during the left sweep';
    default:
      return GENERIC_GAZE_ISSUE;
  }
};

const normalizeIssueFrame = (frame: EyeMovementIssueFrame): EyeMovementIssueFrame => {
  const normalizedIssue = frame.issue === GENERIC_GAZE_ISSUE ? getPhaseIssueLabel(frame.phase) : frame.issue;
  const normalizedDetail =
    frame.detail ||
    (frame.phase && normalizedIssue !== GENERIC_GAZE_ISSUE
      ? `This frame was flagged during ${formatPhaseName(frame.phase)}.`
      : undefined);

  return {
    ...frame,
    issue: normalizedIssue,
    detail: normalizedDetail,
  };
};

const hasReliableEyeTracking = (result: EyeMovementPrediction) => {
  const analyzedFrames = result.quality.analyzedFrameCount ?? 0;
  const trackedFrames = result.quality.usableSampleCount ?? 0;
  const usableDuration = result.quality.usableDurationSeconds ?? 0;

  return (
    analyzedFrames >= MIN_RELIABLE_ANALYZED_FRAMES &&
    trackedFrames >= MIN_RELIABLE_TRACKED_FRAMES &&
    usableDuration >= MIN_RELIABLE_DURATION_SECONDS
  );
};

const normalizePrediction = (result: EyeMovementPrediction): EyeMovementPrediction => ({
  ...result,
  quality: {
    ...result.quality,
    issueFrames: result.quality.issueFrames?.map(normalizeIssueFrame),
  },
});

const getSupportedVideoMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';

  const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
};

const getGuideTarget = (seconds: number) => {
  if (seconds < 2) return { x: 0, y: 0 };
  if (seconds < 4) return { x: -0.75, y: 0 };
  if (seconds < 6) return { x: 0.75, y: 0 };
  if (seconds < 8) return { x: 0, y: 0 };
  if (seconds < 10) return { x: 0, y: -0.55 };
  if (seconds < 12) return { x: 0, y: 0.55 };
  if (seconds < 15) {
    const progress = (seconds - 12) / 3;
    return { x: -0.75 + 1.5 * progress, y: 0 };
  }
  if (seconds < 18) {
    const progress = (seconds - 15) / 3;
    return { x: 0.75 - 1.5 * progress, y: 0 };
  }
  return { x: 0, y: 0 };
};

const getProtocolStageLabel = (seconds: number) => {
  if (seconds < 2) return 'Center hold';
  if (seconds < 4) return 'Look left';
  if (seconds < 6) return 'Look right';
  if (seconds < 8) return 'Center reset';
  if (seconds < 10) return 'Look up';
  if (seconds < 12) return 'Look down';
  if (seconds < 15) return 'Sweep right';
  if (seconds < 18) return 'Sweep left';
  return 'Center finish';
};

const MetricCard = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

const EyeMovementModal = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const copy = eyeMovementCopy[language] as AppCopy;

  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisDebug, setAnalysisDebug] = useState<EyeMovementDebugPayload | null>(null);
  const [prediction, setPrediction] = useState<EyeMovementPrediction | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const shouldAnalyzeRef = useRef(true);
  const cameraInitInFlightRef = useRef(false);
  const cameraRequestIdRef = useRef(0);
  const mountedRef = useRef(false);

  const guideTarget = useMemo(() => getGuideTarget(elapsedSeconds), [elapsedSeconds]);
  const currentStageLabel = useMemo(
    () => (recording ? getProtocolStageLabel(elapsedSeconds) : 'Waiting'),
    [elapsedSeconds, recording],
  );

  useEffect(() => {
    mountedRef.current = true;
    void initializeCamera();
    return () => {
      mountedRef.current = false;
      stopActiveRecording(false);
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const ensureVideoPlayback = async (stream: MediaStream) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.playsInline = true;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await videoElement.play();
        return;
      } catch (error) {
        const playbackError = error as DOMException;
        if (playbackError.name === 'AbortError') {
          await new Promise((resolve) => window.setTimeout(resolve, 120));
          if (videoRef.current?.srcObject !== stream) {
            return;
          }
          continue;
        }
        throw error;
      }
    }
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const initializeCamera = async () => {
    if (cameraInitInFlightRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setAnalysisError(copy.noCamera);
      return;
    }

    if (streamRef.current && videoRef.current?.srcObject === streamRef.current) {
      try {
        await ensureVideoPlayback(streamRef.current);
      } catch (error) {
        console.error('Eye movement camera playback error:', error);
      }
      setCameraReady(true);
      setAnalysisError(null);
      return;
    }

    cameraInitInFlightRef.current = true;
    const requestId = cameraRequestIdRef.current + 1;
    cameraRequestIdRef.current = requestId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current || requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      if (streamRef.current && streamRef.current !== stream) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = stream;
      await ensureVideoPlayback(stream);
      if (!mountedRef.current || requestId !== cameraRequestIdRef.current) return;
      setCameraReady(true);
      setAnalysisError(null);
      setAnalysisDebug(null);
    } catch (error) {
      console.error('Eye movement camera error:', error);
      if (mountedRef.current) {
        setCameraReady(false);
        setAnalysisError(copy.noCamera);
      }
    } finally {
      if (requestId === cameraRequestIdRef.current) {
        cameraInitInFlightRef.current = false;
      }
    }
  };

  const savePrediction = async (result: EyeMovementPrediction) => {
    if (!user) return;

    setSaving(true);
    try {
      const resultPayload = {
        label: result.label,
        confidence: result.confidence,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        classification: result.classification,
        explanation: result.explanation,
        details: result.details ?? result.explanation,
        probabilities: result.probabilities,
        metrics: result.metrics,
        quality: result.quality,
        protocol: result.protocol,
        createdAt: new Date().toISOString(),
        source: 'guided-eye-movement-live',
        modelName: result.modelInfo.name,
      };

      const { id } = await insertTestRecord({
        patient_id: user.id,
        test_type: 'video',
        raw_storage_path: null,
        status: 'completed',
        result: resultPayload,
        confidence: result.confidence,
        model_versions: {
          eyeMovement: result.modelInfo.name,
          protocol: result.modelInfo.guidedProtocol,
        },
      });

      const localRecord = {
        id: id || `eye-video-local-${Date.now()}`,
        patient_id: user.id,
        test_type: 'video',
        raw_storage_path: null,
        status: 'completed',
        created_at: new Date().toISOString(),
        result: resultPayload,
        confidence: result.confidence,
        model_versions: {
          eyeMovement: result.modelInfo.name,
          protocol: result.modelInfo.guidedProtocol,
        },
      };

      const localTests = JSON.parse(localStorage.getItem('local_tests') || '[]');
      localTests.unshift(localRecord);
      localStorage.setItem('local_tests', JSON.stringify(localTests));

      setSaveMessage(id ? copy.saved : copy.savedLocal);
    } catch (error) {
      console.error('Eye movement save error:', error);
      setSaveMessage(copy.savedLocal);
    } finally {
      setSaving(false);
    }
  };

  const runPrediction = async (videoBlob: Blob) => {
    try {
      setAnalysisError(null);
      setAnalysisDebug(null);
      setAnalysisStep(copy.uploading);
      const rawResult = await predictEyeMovement(videoBlob);
      const result = normalizePrediction(rawResult);

      if (!hasReliableEyeTracking(result)) {
        throw new EyeMovementApiError(
          'This recording did not contain enough reliable eye-tracking data to grade safely. Please restart the backend, rerun the 20-second test, and keep your face centered in the guide.',
          {
            reason:
              'The app received too few analyzed eye-tracking frames for a dependable result, so the prediction was rejected instead of being shown.',
            counts: {
              analyzedFrames: result.quality.analyzedFrameCount,
              trackedFrames: result.quality.usableSampleCount,
              faceMissingFrames: result.quality.reasonSummary?.faceMissingFrames,
              eyeGeometryFailedFrames: result.quality.reasonSummary?.eyeGeometryFailedFrames,
            },
            issueFrames: result.quality.issueFrames,
          },
        );
      }

      setPrediction(result);
      setAnalysisStep(copy.saving);
      await savePrediction(result);
      setAnalysisStep('');
    } catch (error) {
      console.error('Eye movement analysis error:', error);
      setPrediction(null);
      setAnalysisStep('');
      if (error instanceof EyeMovementApiError) {
        setAnalysisDebug(error.debug ?? null);
      }
      setAnalysisError(error instanceof Error ? error.message : 'Unable to analyze the eye movement sample.');
    }
  };

  const stopActiveRecording = (analyze = true) => {
    clearTimer();
    shouldAnalyzeRef.current = analyze;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setRecording(false);
    }

    if (!analyze) {
      chunksRef.current = [];
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      await initializeCamera();
    }
    if (!streamRef.current) return;

    const mimeType = getSupportedVideoMimeType();
    if (!mimeType || typeof MediaRecorder === 'undefined') {
      setAnalysisError(copy.unsupported);
      return;
    }

    setPrediction(null);
    setSaveMessage(null);
    setAnalysisError(null);
    setAnalysisDebug(null);
    setAnalysisStep('');
    setElapsedSeconds(0);
    chunksRef.current = [];
    shouldAnalyzeRef.current = true;

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    startedAtRef.current = performance.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      setRecording(false);
      clearTimer();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      if (!shouldAnalyzeRef.current) {
        shouldAnalyzeRef.current = true;
        return;
      }
      if (blob.size > 0) {
        void runPrediction(blob);
      }
    };

    recorder.start(250);
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      if (!startedAtRef.current) return;

      const elapsed = Math.min((performance.now() - startedAtRef.current) / 1000, TEST_DURATION_SECONDS);
      setElapsedSeconds(elapsed);
      if (elapsed >= TEST_DURATION_SECONDS) {
        stopActiveRecording(true);
      }
    }, 100);
  };

  const guideStyle = {
    left: `${50 + guideTarget.x * 36}%`,
    top: `${50 + guideTarget.y * 34}%`,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/25 px-2 py-2 backdrop-blur-sm sm:px-3 sm:py-3">
      <div className="flex min-h-full items-stretch justify-center">
        <div className="relative flex h-[96vh] w-full max-w-[1800px] flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-background/95 shadow-[0_30px_90px_rgba(44,44,36,0.18)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(93,112,82,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(193,140,93,0.12),_transparent_38%)]" />

          <div className="relative flex items-start justify-between gap-4 border-b border-border/70 bg-background/90 px-5 py-4 sm:px-6 sm:py-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">{copy.badge}</p>
              <h3 className="text-xl font-bold text-foreground sm:text-2xl">{copy.title}</h3>
              <p className="max-w-4xl text-sm text-muted-foreground">{copy.description}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {!prediction ? (
              <div className="flex h-full flex-col gap-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]">
                  <div className="rounded-[1.75rem] border border-border/70 bg-background/70 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Video className="h-5 w-5 text-primary" />
                      <p className="font-semibold text-foreground">{copy.liveCamera}</p>
                    </div>
                    <div className="relative h-[22rem] overflow-hidden rounded-[1.5rem] bg-black sm:h-[25rem]">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`h-full w-full scale-x-[-1] object-cover transition-opacity duration-500 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
                      />
                      {!cameraReady ? (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                          {copy.cameraPreparing}
                        </div>
                      ) : (
                        <div className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white">
                          {copy.cameraLive}
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="relative h-[66%] w-[42%] rounded-[999px] border-2 border-white/75 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]">
                          <div className="absolute inset-x-0 bottom-5 text-center text-xs font-semibold tracking-[0.12em] text-white/90">
                            KEEP FACE INSIDE THIS OVAL
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{copy.faceHint}</p>
                  </div>

                  <div className="rounded-[1.75rem] border border-border/70 bg-muted/45 p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{copy.protocolTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{copy.protocolBody}</p>
                      </div>
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {recording ? copy.protocolRunning : copy.ready}
                      </div>
                    </div>

                    <div className="relative h-[22rem] overflow-hidden rounded-[1.5rem] border border-border bg-background/80 sm:h-[25rem]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(93,112,82,0.08),_transparent_55%)]" />
                      <div className="absolute inset-0">
                        <div className="absolute left-1/2 top-8 bottom-8 w-px -translate-x-1/2 bg-border/60" />
                        <div className="absolute left-8 right-8 top-1/2 h-px -translate-y-1/2 bg-border/60" />
                      </div>
                      <div className="absolute inset-x-0 top-5 px-4 text-center text-xs font-medium text-muted-foreground">
                        {recording ? copy.secondsLeft(TEST_DURATION_SECONDS - elapsedSeconds) : copy.steps[3]}
                      </div>
                      <div className="absolute inset-x-8 inset-y-8 rounded-[1.4rem] border border-dashed border-border/80" />
                      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/35 bg-primary/10" />
                      <div
                        className={`absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-lg transition-all duration-150 ${
                          recording ? 'bg-primary' : 'bg-secondary'
                        }`}
                        style={guideStyle}
                      />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{copy.liveStatusHint}</p>
                  </div>

                  <div className="space-y-5 xl:sticky xl:top-0">
                    <div className="rounded-[1.75rem] border border-border/70 bg-background/75 p-5">
                      <div className="mb-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{copy.liveStatus}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{recording ? copy.recording : copy.ready}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <MetricCard label={copy.stage} value={currentStageLabel} />
                        <MetricCard label={copy.trackedFrames} value={cameraReady ? 'Camera ready' : 'Starting'} />
                      </div>

                      <div className="mt-5 flex items-start gap-3">
                        <div className="rounded-[1.2rem] bg-primary/10 p-3 text-primary">
                          <Eye className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-foreground">{copy.stepsTitle}</p>
                          <div className="mt-3 space-y-2">
                            {copy.steps.map((step) => (
                              <div key={step} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <span className="mt-1 h-2 w-2 rounded-full bg-primary/60" />
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex gap-3">
                        {recording ? (
                          <button
                            onClick={() => stopActiveRecording(true)}
                            className="flex-1 rounded-[1.2rem] bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/90"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Square className="h-4 w-4" />
                              {copy.stop}
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => void startRecording()}
                            disabled={!cameraReady}
                            className="flex-1 rounded-[1.2rem] bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                          >
                            {copy.start}
                          </button>
                        )}
                      </div>
                    </div>

                    {analysisStep ? (
                      <div className="rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          <p>{analysisStep}</p>
                        </div>
                      </div>
                    ) : null}

                    {analysisError ? (
                      <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-destructive">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={16} />
                          <p className="text-xs font-medium">{analysisError}</p>
                        </div>

                        {analysisDebug ? (
                          <div className="rounded-[1.25rem] border border-destructive/20 bg-background/75 p-4 text-foreground">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{copy.diagnosticsTitle}</p>
                            {analysisDebug.reason ? (
                              <p className="mt-2 text-sm">
                                <span className="font-semibold">{copy.diagnosticsReason}: </span>
                                {analysisDebug.reason}
                              </p>
                            ) : null}

                            {analysisDebug.counts ? (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <MetricCard label={copy.diagnosticsCounts.total} value={String(analysisDebug.counts.totalFrames ?? 0)} />
                                <MetricCard label={copy.diagnosticsCounts.analyzed} value={String(analysisDebug.counts.analyzedFrames ?? 0)} />
                                <MetricCard label={copy.diagnosticsCounts.tracked} value={String(analysisDebug.counts.trackedFrames ?? 0)} />
                                <MetricCard label={copy.diagnosticsCounts.faceMissing} value={String(analysisDebug.counts.faceMissingFrames ?? 0)} />
                                <MetricCard label={copy.diagnosticsCounts.eyeFail} value={String(analysisDebug.counts.eyeGeometryFailedFrames ?? 0)} />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-border/70 bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{copy.explanation}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    After the recording finishes, the analyzer highlights the frames with the largest tracking problems so you can see where eye control or face alignment broke down.
                  </p>
                </div>

                {analysisDebug?.issueFrames && analysisDebug.issueFrames.length > 0 ? (
                  <div className="rounded-[1.75rem] border border-border/70 bg-background/75 p-5">
                    <p className="mb-3 text-sm font-semibold text-foreground">{copy.diagnosticsFrames}</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {analysisDebug.issueFrames.map((frame) => (
                        <div key={`${frame.frameIndex}-${frame.timestampSeconds}`} className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background">
                            <img src={frame.image} alt={`Issue frame ${frame.frameIndex}`} className="aspect-video w-full object-cover" />
                            <div className="space-y-1 p-3 text-xs">
                              <p className="font-semibold text-foreground">{frame.issue}</p>
                              <p className="text-muted-foreground">Frame {frame.frameIndex} at {frame.timestampSeconds.toFixed(2)}s</p>
                              {frame.phase ? <p className="text-muted-foreground">Phase: {frame.phase}</p> : null}
                              {frame.detail ? <p className="text-muted-foreground">{frame.detail}</p> : null}
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-5">
                <div className={`rounded-[1.75rem] border p-5 ${prediction.label === 'Parkinsons' ? 'border-secondary/30 bg-secondary/10' : 'border-primary/25 bg-primary/10'}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] ${prediction.label === 'Parkinsons' ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary'}`}>
                        <ScanLine className="h-7 w-7" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm leading-relaxed text-foreground">{prediction.explanation}</p>
                        {saveMessage ? <span className="inline-flex rounded-full bg-background/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground">{saveMessage}</span> : null}
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-border/70 bg-background/75 px-4 py-3 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{copy.confidence}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{(prediction.confidence * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <MetricCard label={copy.metrics.saccade} value={`${prediction.metrics.saccadicSpeed.toFixed(2)} u/s`} />
                  <MetricCard label={copy.metrics.smoothness} value={prediction.metrics.trackingSmoothness.toFixed(2)} />
                  <MetricCard label={copy.metrics.blinkRate} value={`${prediction.metrics.blinkRatePerMinute.toFixed(1)}/min`} hint={`${prediction.metrics.blinkCount} blinks`} />
                  <MetricCard label={copy.metrics.fixation} value={prediction.metrics.fixationDrift.toFixed(2)} />
                  <MetricCard label={copy.metrics.response} value={`${Math.round(prediction.metrics.responseDelaySeconds * 1000)} ms`} />
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/75 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{copy.quality}</p>
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin text-primary" /> : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <MetricCard label={copy.trackedFrames} value={`${Math.round(prediction.quality.trackedFrameRatio * 100)}%`} />
                    <MetricCard label={copy.usableDuration} value={`${prediction.quality.usableDurationSeconds.toFixed(1)}s`} />
                    <MetricCard label={copy.qualityScore} value={prediction.quality.qualityScore.toFixed(2)} />
                  </div>

                  {prediction.quality.protocolComplianceScore !== undefined ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <MetricCard
                        label={copy.protocolCompliance}
                        value={`${Math.round(prediction.quality.protocolComplianceScore * 100)}%`}
                      />
                    </div>
                  ) : null}

                  {(prediction.quality.analyzedFrameCount !== undefined ||
                    prediction.quality.usableSampleCount !== undefined ||
                    prediction.quality.reasonSummary) ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label={copy.diagnosticsCounts.analyzed} value={String(prediction.quality.analyzedFrameCount ?? 0)} />
                      <MetricCard label={copy.diagnosticsCounts.tracked} value={String(prediction.quality.usableSampleCount ?? 0)} />
                      <MetricCard
                        label={copy.diagnosticsCounts.faceMissing}
                        value={String(prediction.quality.reasonSummary?.faceMissingFrames ?? 0)}
                      />
                      <MetricCard
                        label={copy.diagnosticsCounts.eyeFail}
                        value={String(prediction.quality.reasonSummary?.eyeGeometryFailedFrames ?? 0)}
                      />
                    </div>
                  ) : null}

                  {prediction.quality.issueFrames && prediction.quality.issueFrames.length > 0 ? (
                    <div className="mt-4">
                      <p className="mb-3 text-sm font-semibold text-foreground">{copy.diagnosticsFrames}</p>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {prediction.quality.issueFrames.map((frame) => (
                          <div key={`${frame.frameIndex}-${frame.timestampSeconds}`} className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background">
                            <img src={frame.image} alt={`Issue frame ${frame.frameIndex}`} className="aspect-video w-full object-cover" />
                            <div className="space-y-1 p-3 text-xs">
                              <p className="font-semibold text-foreground">{frame.issue}</p>
                              <p className="text-muted-foreground">Frame {frame.frameIndex} at {frame.timestampSeconds.toFixed(2)}s</p>
                              {frame.phase ? <p className="text-muted-foreground">Phase: {frame.phase}</p> : null}
                              {frame.detail ? <p className="text-muted-foreground">{frame.detail}</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      setPrediction(null);
                      setSaveMessage(null);
                      setAnalysisError(null);
                      setAnalysisDebug(null);
                      setElapsedSeconds(0);
                    }}
                    className="rounded-[1.25rem] border border-border bg-background/80 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    {copy.retake}
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-[1.25rem] bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {copy.done}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EyeMovementModal;
