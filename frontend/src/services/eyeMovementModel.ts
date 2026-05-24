import { AxiosError } from 'axios';
import apiClient from './api';

export type EyeMovementClassification =
  | 'No Parkinsonian Eye Movement Detected'
  | 'Potential Parkinsonian Indicators Detected';

export interface EyeMovementPrediction {
  classification: EyeMovementClassification;
  label: 'Healthy' | 'Parkinsons';
  confidence: number;
  riskScore: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  explanation: string;
  details?: string;
  metrics: {
    saccadicSpeed: number;
    trackingSmoothness: number;
    blinkRatePerMinute: number;
    blinkIrregularity: number;
    fixationDrift: number;
    responseDelaySeconds: number;
    trackingError: number;
    eyelidMovementVariance: number;
    blinkCount: number;
    protocolComplianceScore?: number;
  };
  probabilities: {
    Parkinsons: number;
    Healthy: number;
  };
  quality: {
    trackedFrameRatio: number;
    usableDurationSeconds: number;
    qualityScore: number;
    protocolComplianceScore?: number;
    analyzedFrameCount?: number;
    usableSampleCount?: number;
    reasonSummary?: {
      faceMissingFrames: number;
      eyeGeometryFailedFrames: number;
    };
    issueFrames?: EyeMovementIssueFrame[];
  };
  protocol: string;
  modelInfo: {
    name: string;
    type: 'video';
    guidedProtocol: string;
  };
}

export interface EyeMovementIssueFrame {
  frameIndex: number;
  timestampSeconds: number;
  issue: string;
  image: string;
  phase?: string;
  score?: number;
  detail?: string;
}

export interface EyeMovementDebugPayload {
  reason?: string;
  counts?: {
    totalFrames?: number;
    analyzedFrames?: number;
    trackedFrames?: number;
    faceMissingFrames?: number;
    eyeGeometryFailedFrames?: number;
  };
  issueFrames?: EyeMovementIssueFrame[];
}

export class EyeMovementApiError extends Error {
  debug?: EyeMovementDebugPayload;

  constructor(message: string, debug?: EyeMovementDebugPayload) {
    super(message);
    this.name = 'EyeMovementApiError';
    this.debug = debug;
  }
}

export async function predictEyeMovement(video: Blob) {
  try {
    const formData = new FormData();
    formData.append('video', video, 'eye-movement.webm');
    formData.append('protocol', 'guided-eye-follow-v1');

    const response = await apiClient.post<EyeMovementPrediction>('/eye-movement/predict', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: string; message?: string; debug?: EyeMovementDebugPayload }>;
    const message =
      axiosError.response?.data?.error ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Eye-movement analysis failed.';
    throw new EyeMovementApiError(message, axiosError.response?.data?.debug);
  }
}
