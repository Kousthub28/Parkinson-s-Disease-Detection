import type { PoseFrame } from './therapyTypes';

declare global {
  interface Window {
    Pose?: new (options: { locateFile: (file: string) => string }) => {
      setOptions: (options: Record<string, unknown>) => void;
      onResults: (callback: (results: Record<string, unknown>) => void) => void;
      send: (payload: { image: HTMLVideoElement }) => Promise<void>;
      close?: () => void;
    };
    drawConnectors?: (
      ctx: CanvasRenderingContext2D,
      landmarks: unknown[],
      connections: unknown[],
      options?: Record<string, unknown>,
    ) => void;
    drawLandmarks?: (
      ctx: CanvasRenderingContext2D,
      landmarks: unknown[],
      options?: Record<string, unknown>,
    ) => void;
    POSE_CONNECTIONS?: unknown[];
  }
}

const SCRIPT_URLS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
];

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
  const existing = document.querySelector(`script[data-therapy-script="${src}"]`) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === 'true') {
    resolve();
    return;
  }

  const script = existing ?? document.createElement('script');
  script.src = src;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.therapyScript = src;

  const handleLoad = () => {
    script.dataset.loaded = 'true';
    resolve();
  };

  const handleError = () => reject(new Error(`Failed to load pose runtime: ${src}`));

  script.addEventListener('load', handleLoad, { once: true });
  script.addEventListener('error', handleError, { once: true });

  if (!existing) {
    document.head.appendChild(script);
  }
});

const getVideoDimensions = (video: HTMLVideoElement) => ({
  width: video.videoWidth || 640,
  height: video.videoHeight || 480,
});

export class BrowserPoseDetector {
  private pose: ReturnType<NonNullable<Window['Pose']>> | null = null;
  private latestFrame: PoseFrame | null = null;
  private latestRawLandmarks: unknown[] = [];
  private busy = false;
  private initialized = false;
  private initializationFailed = false;
  private sendErrorCount = 0;
  private lastSendTime = 0;
  private pendingSubmit: Promise<void> | null = null;
  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;

  async initialize() {
    if (this.initializationFailed) {
      throw new Error('Pose detection initialization has failed previously. Reload the page to retry.');
    }

    // Load scripts sequentially to avoid race conditions
    for (const url of SCRIPT_URLS) {
      try {
        await loadScript(url);
      } catch (error) {
        console.error(`Failed to load ${url}:`, error);
        this.initializationFailed = true;
        throw new Error(`Failed to load pose model: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!window.Pose) {
      this.initializationFailed = true;
      throw new Error('MediaPipe Pose is unavailable in this browser. Please try a modern browser like Chrome or Firefox.');
    }

    try {
      const pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        // Use model complexity 0 (lite) for WASM stability
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: false,
        // Slightly higher thresholds for stability
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

      pose.onResults((results) => {
        try {
          const poseLandmarks = Array.isArray(results.poseLandmarks) ? results.poseLandmarks : [];
          this.latestRawLandmarks = poseLandmarks;

          if (!poseLandmarks.length) {
            this.latestFrame = null;
            return;
          }

          const image = results.image as HTMLVideoElement | undefined;
          const dimensions = image ? getVideoDimensions(image) : { width: 640, height: 480 };

          this.latestFrame = {
            landmarks: poseLandmarks.map((landmark: Record<string, number>) => ({
              x: landmark.x ?? 0,
              y: landmark.y ?? 0,
              z: landmark.z ?? 0,
              visibility: landmark.visibility ?? 0,
            })),
            timestamp: performance.now(),
            ...dimensions,
          };
          this.consecutiveErrors = 0; // Reset on success
        } catch (callbackError) {
          console.error('Error processing pose results:', callbackError);
        }
      });

      this.pose = pose;
      this.initialized = true;
      this.consecutiveErrors = 0;
    } catch (initError) {
      this.initializationFailed = true;
      throw new Error(`Failed to initialize pose model: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
    }
  }

  async estimate(video: HTMLVideoElement) {
    // If initialization failed, keep returning null
    if (this.initializationFailed) {
      return null;
    }

    // If not initialized yet, return cached frame
    if (!this.pose || !this.initialized) {
      return this.latestFrame;
    }

    // If too many consecutive errors, stop trying temporarily
    if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
      const timeSinceLastSend = performance.now() - this.lastSendTime;
      // Wait 2 seconds before retrying after max errors
      if (timeSinceLastSend < 2000) {
        return this.latestFrame;
      }
      this.consecutiveErrors = 0; // Reset and try again
    }

    // If previous submit is still pending, don't start another
    if (this.pendingSubmit) {
      try {
        await Promise.race([
          this.pendingSubmit,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
        ]);
      } catch {
        // Timeout or error, clear pending state
        this.pendingSubmit = null;
        this.busy = false;
      }
      return this.latestFrame;
    }

    // Skip if already processing
    if (this.busy) {
      return this.latestFrame;
    }

    this.busy = true;
    this.lastSendTime = performance.now();

    try {
      // Add strict timeout wrapper to prevent WASM hang
      this.pendingSubmit = Promise.race([
        this.pose.send({ image: video }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Pose detection timeout')), 600)
        ),
      ]);

      await this.pendingSubmit;
      this.pendingSubmit = null;
      return this.latestFrame;
    } catch (error) {
      // MediaPipe send can fail if video isn't ready, WebGL context lost, or timeout
      this.consecutiveErrors += 1;
      console.debug('Pose detection error (will retry):', error instanceof Error ? error.message : error);
      this.pendingSubmit = null;
      return this.latestFrame;
    } finally {
      this.busy = false;
    }
  }

  draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, frame: PoseFrame | null) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = getVideoDimensions(video);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    if (!frame || !this.latestRawLandmarks.length) return;

    try {
      window.drawConnectors?.(ctx, this.latestRawLandmarks, window.POSE_CONNECTIONS ?? [], {
        color: '#D3A15D',
        lineWidth: 3,
      });
      window.drawLandmarks?.(ctx, this.latestRawLandmarks, {
        color: '#F7F2E8',
        fillColor: '#5D7052',
        radius: 4,
      });
    } catch {
      // Drawing can fail if canvas context is lost, just skip
    }
  }

  isReady() {
    return this.initialized && this.pose !== null;
  }

  dispose() {
    try {
      this.pose?.close?.();
    } catch {
      // Ignore dispose errors
    }
    this.pose = null;
    this.latestFrame = null;
    this.latestRawLandmarks = [];
    this.initialized = false;
    this.busy = false;
    this.consecutiveErrors = 0;
    this.pendingSubmit = null;
    // Note: intentionally NOT resetting initializationFailed so the error persists across attempts
  }
}
