import { useState, useRef, useEffect } from 'react';
import Card from './Card';
import { Mic, X, LoaderCircle, AlertCircle, Square, Scan } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { processTest } from '../services/api';
import {
  extractVoiceFeatures,
  predictVoiceSample,
  trainVoiceKnnModel,
  VoicePrediction,
  VoiceModelMetadata,
  VoiceFeatureVector,
} from '../services/voiceKnnModel';

type PrescriptionPlan = {
  summary: string;
  symptomFlags: string[];
  recommendations: string[];
};

const deriveRiskLevel = (probability: number): 'High' | 'Medium' | 'Low' => {
  if (probability >= 0.7) return 'High';
  if (probability >= 0.4) return 'Medium';
  return 'Low';
};

const describeVoiceSymptoms = (features: VoiceFeatureVector): string[] => {
  const flags: string[] = [];
  if (features.locPctJitter > 1.2) {
    flags.push('Elevated jitter suggests tremor during sustained phonation.');
  }
  if (features.ppq5Jitter > 0.6) {
    flags.push('Perturbation quotient shows irregular pitch periods.');
  }
  if (features.locShimmer > 1.5) {
    flags.push('Increased shimmer highlights amplitude instability.');
  }
  if (features.apq5Shimmer > 3) {
    flags.push('Voice amplitude variability (APQ5) exceeds healthy limits.');
  }
  if (features.meanNoiseToHarmHarmonicity > 0.25) {
    flags.push('Noise-to-harmonics ratio indicates breathiness or vocal fatigue.');
  }
  return flags.length ? flags : ['Voice parameters remain within expected healthy ranges.'];
};

const generatePrescriptionPlan = (prediction: VoicePrediction, features: VoiceFeatureVector): PrescriptionPlan => {
  const riskLevel = deriveRiskLevel(prediction.probabilityOfParkinsons);
  const symptomFlags = describeVoiceSymptoms(features);
  const probabilityText = (prediction.probabilityOfParkinsons * 100).toFixed(1);
  const summary = prediction.label === 'Parkinsons'
    ? `Voice screening indicates a ${riskLevel.toLowerCase()} risk for Parkinsonian speech changes (probability ${probabilityText}%).`
    : `Voice screening suggests low likelihood of Parkinsonian speech changes (probability ${probabilityText}%).`;

  const recommendations: string[] = [
    'Share this screening summary with your neurologist or speech therapist.',
    riskLevel === 'High'
      ? 'Arrange a comprehensive neurological and speech-language evaluation within 14 days.'
      : riskLevel === 'Medium'
        ? 'Book a clinical follow-up within the next month to confirm findings.'
        : 'Repeat the voice screening monthly to monitor any emerging changes.',
    'Practice daily vocal warm-up and breath support exercises for at least 10 minutes.',
  ];

  if (riskLevel !== 'Low') {
    recommendations.push('Keep a brief symptom journal (voice fatigue, tremors, medication changes) to review with your care team.');
  }

  return { summary, symptomFlags, recommendations };
};

const FEATURE_LABELS: Record<keyof VoiceFeatureVector, string> = {
  meanPeriodPulses: 'Mean period (pulses)',
  stdDevPeriodPulses: 'Std dev period (pulses)',
  locPctJitter: 'Local jitter %',
  locAbsJitter: 'Local jitter (abs)',
  rapJitter: 'RAP jitter %',
  ppq5Jitter: 'PPQ5 jitter %',
  ddpJitter: 'DDP jitter %',
  locShimmer: 'Local shimmer %',
  locDbShimmer: 'Local shimmer (dB)',
  apq3Shimmer: 'APQ3 shimmer %',
  apq5Shimmer: 'APQ5 shimmer %',
  apq11Shimmer: 'APQ11 shimmer %',
  ddaShimmer: 'DDA shimmer %',
  meanAutoCorrHarmonicity: 'Mean autocorrelation harmonicity',
  meanNoiseToHarmHarmonicity: 'Mean noise-to-harmonics',
  meanHarmToNoiseHarmonicity: 'Mean harmonics-to-noise',
};

const formatFeatureLabel = (key: keyof VoiceFeatureVector): string => FEATURE_LABELS[key] ?? key;

const formatFeatureValue = (value: number): string => {
  const absolute = Math.abs(value);
  if (absolute >= 100) return value.toFixed(0);
  if (absolute >= 10) return value.toFixed(1);
  if (absolute >= 1) return value.toFixed(2);
  return value.toFixed(3);
};

const VoiceCaptureModal = ({ onClose }: { onClose: () => void }) => {
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [prediction, setPrediction] = useState<VoicePrediction | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [modelMetadata, setModelMetadata] = useState<VoiceModelMetadata | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [featureVector, setFeatureVector] = useState<VoiceFeatureVector | null>(null);
  const [prescription, setPrescription] = useState<PrescriptionPlan | null>(null);
  const [savingResult, setSavingResult] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedTestId, setSavedTestId] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingPrompt, setRecordingPrompt] = useState<string>('');
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();

  const RECORDING_PROMPTS = [
    'Please say "Aaaah" steadily for as long as you can.',
    'Count from one to ten at your natural pace.',
    'Repeat: "The quick brown fox jumps over the lazy dog."',
  ];
  const RECORDING_DURATION_SECONDS = 30;
  const MIN_RECORDING_DURATION_SECONDS = 3;

  useEffect(() => {
    let cancelled = false;
    setModelLoading(true);
    trainVoiceKnnModel()
      .then((metadata) => {
        if (cancelled) return;
        setModelMetadata(metadata);
        setModelError(null);
      })
      .catch((modelInitError) => {
        if (cancelled) return;
        const message = modelInitError instanceof Error
          ? modelInitError.message
          : 'Failed to initialise the voice screening model.';
        setModelError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setModelLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startRecording = async () => {
    try {
      setPrediction(null);
      setAnalysisError(null);
      setFeatureVector(null);
      setPrescription(null);
      setSaveMessage(null);
      setSavedTestId(null);
      setSuccess(false);
      setError(null);
      setRecordingDuration(0);

      // Select a random prompt
      const prompt = RECORDING_PROMPTS[Math.floor(Math.random() * RECORDING_PROMPTS.length)];
      setRecordingPrompt(prompt);

      // Speak the prompt using Web Speech API
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(prompt);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStatus('recording');
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        audioChunksRef.current = [];
        setRecordingStatus('recorded');
        stream.getTracks().forEach(track => track.stop()); // Stop mic access

        // Clear timers
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (autoStopTimerRef.current) {
          clearTimeout(autoStopTimerRef.current);
          autoStopTimerRef.current = null;
        }

        // Automatically trigger KNN analysis after recording
        setTimeout(() => {
          if (!modelError && blob) {
            // Trigger analysis with the new blob
            setAudioBlob(blob);
            triggerAnalysis(blob);
          }
        }, 500);
      };
      mediaRecorderRef.current.start();

      // Start duration counter
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Auto-stop after max duration
      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, RECORDING_DURATION_SECONDS * 1000);
    } catch (err) {
      setError('Microphone access was denied. Please enable it in your browser settings.');
      console.error("Error accessing microphone:", err);
    }
  };

  const persistScreeningResult = async (
    features: VoiceFeatureVector,
    result: VoicePrediction,
    plan: PrescriptionPlan,
  ) => {
    if (!user) {
      setSaveMessage('Sign in to save results to your dashboard.');
      return;
    }
    setSavingResult(true);
    setSaveMessage(null);
    const riskScore = Number((result.probabilityOfParkinsons * 10).toFixed(1));
    const riskLevel = deriveRiskLevel(result.probabilityOfParkinsons);
    const resultPayload = {
      label: result.label,
      probability: result.probabilityOfParkinsons,
      riskScore,
      riskLevel,
      neighbourVotes: result.neighbourVotes,
      features,
      prescription: plan,
      createdAt: new Date().toISOString(),
      source: 'voice-screening-local',
    };

    try {
      if (savedTestId) {
        const { error: updateError } = await supabase
          .from('tests')
          .update({
            result: resultPayload,
            confidence: result.probabilityOfParkinsons,
            model_versions: {
              voiceKnn: `k=${result.k}`,
              dataset: 'pd_speech_features.csv',
            },
          })
          .eq('id', savedTestId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('tests')
          .insert({
            patient_id: user.id,
            test_type: 'speech',
            raw_storage_path: null,
            result: resultPayload,
            confidence: result.probabilityOfParkinsons,
            model_versions: {
              voiceKnn: `k=${result.k}`,
              dataset: 'pd_speech_features.csv',
            },
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        if (data?.id) {
          setSavedTestId(data.id);
        }
      }
      setSaveMessage('Screening saved to dashboard.');
    } catch (dbError) {
      const message = dbError instanceof Error
        ? dbError.message
        : 'Failed to save screening result to Supabase.';
      setAnalysisError(message);
      console.error('Failed to persist voice screening result:', dbError);
    } finally {
      setSavingResult(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingStatus === 'recording') {
      // Check minimum duration
      if (recordingDuration < MIN_RECORDING_DURATION_SECONDS) {
        setError(`Please record for at least ${MIN_RECORDING_DURATION_SECONDS} seconds.`);
        return;
      }
      mediaRecorderRef.current.stop();
    }
  };

  const triggerAnalysis = async (blob: Blob) => {
    if (!blob || modelError) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setSaveMessage(null);
    setAnalysisStep('');
    try {
      setAnalysisStep('Extracting voice features from audio...');
      const features = await extractVoiceFeatures(blob);
      
      setAnalysisStep(`Comparing with ${modelMetadata?.sampleCount || 188} training samples using KNN algorithm...`);
      const result = await predictVoiceSample(features);
      
      setAnalysisStep('Generating prescription plan based on voice patterns...');
      const plan = generatePrescriptionPlan(result, features);
      
      setFeatureVector(features);
      setPrescription(plan);
      setPrediction(result);
      
      setAnalysisStep('Saving screening results to database...');
      await persistScreeningResult(features, result, plan);
      
      setAnalysisStep('Analysis complete!');
    } catch (analysisFailure) {
      const message = analysisFailure instanceof Error
        ? analysisFailure.message
        : 'Unable to analyse the voice recording locally.';
      setAnalysisError(message);
      setPrediction(null);
      setFeatureVector(null);
      setPrescription(null);
      setAnalysisStep('');
      console.error('Voice analysis failed:', analysisFailure);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!audioBlob || modelError) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setSaveMessage(null);
    setAnalysisStep('');
    try {
      setAnalysisStep('Extracting voice features from audio...');
      const features = await extractVoiceFeatures(audioBlob);
      
      setAnalysisStep(`Comparing with ${modelMetadata?.sampleCount || 188} training samples using KNN algorithm...`);
      const result = await predictVoiceSample(features);
      
      setAnalysisStep('Generating prescription plan based on voice patterns...');
      const plan = generatePrescriptionPlan(result, features);
      
      setFeatureVector(features);
      setPrescription(plan);
      setPrediction(result);
      
      setAnalysisStep('Saving screening results to database...');
      await persistScreeningResult(features, result, plan);
      
      setAnalysisStep('Analysis complete!');
    } catch (analysisFailure) {
      const message = analysisFailure instanceof Error
        ? analysisFailure.message
        : 'Unable to analyse the voice recording locally.';
      setAnalysisError(message);
      setPrediction(null);
      setFeatureVector(null);
      setPrescription(null);
      setAnalysisStep('');
      console.error('Voice analysis failed:', analysisFailure);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!audioBlob || !user) return;
    setProcessing(true);
    setError(null);
    setSuccess(false);
    setSaveMessage(null);
    try {
      const fileName = `${user.id}-${Date.now()}.webm`;
      const filePath = `voice/${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('test_artifacts').upload(filePath, audioBlob);
      if (uploadError) throw uploadError;
      let targetTestId = savedTestId;
      if (savedTestId) {
        const { error: updateError } = await supabase
          .from('tests')
          .update({ raw_storage_path: filePath })
          .eq('id', savedTestId);
        if (updateError) throw updateError;
      } else {
        const { data: newTestData, error: insertError } = await supabase
          .from('tests')
          .insert({
            patient_id: user.id,
            test_type: 'speech',
            raw_storage_path: filePath,
            result: prediction && featureVector && prescription ? {
              ...prediction,
              riskScore: Number((prediction.probabilityOfParkinsons * 10).toFixed(1)),
              riskLevel: deriveRiskLevel(prediction.probabilityOfParkinsons),
              features: featureVector,
              prescription,
              createdAt: new Date().toISOString(),
              source: 'voice-screening-local',
            } : null,
            confidence: prediction?.probabilityOfParkinsons ?? null,
            model_versions: prediction ? {
              voiceKnn: `k=${prediction.k}`,
              dataset: 'pd_speech_features.csv',
            } : null,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        if (newTestData?.id) {
          targetTestId = newTestData.id;
          setSavedTestId(newTestData.id);
        }
      }
      if (targetTestId) {
        await processTest(targetTestId);
      }
      setSuccess(true);
      setSaveMessage('Voice sample uploaded for cloud analysis.');
    } catch (error: any) {
      setError(error.message || 'An error occurred during upload.');
    } finally {
      setProcessing(false);
    }
  };
  
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Voice Screening (KNN Model)</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X /></button>
        </div>
        
        <div className="space-y-4 text-center">
            {recordingStatus === 'idle' && (
              <>
                <p className="text-muted-foreground">Press the button to start recording your voice. You will be prompted with what to say.</p>
                <button onClick={startRecording} className="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors">
                  <Mic size={40} />
                </button>
              </>
            )}
            {recordingStatus === 'recording' && (
              <>
                <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-4">
                  <p className="text-lg font-semibold text-blue-300 mb-2">Recording Prompt:</p>
                  <p className="text-white text-base">{recordingPrompt}</p>
                </div>
                <div className="flex items-center justify-center space-x-4 mb-2">
                  <div className="text-2xl font-mono text-red-500 animate-pulse">
                    {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    / {RECORDING_DURATION_SECONDS}s max
                  </div>
                </div>
                <p className="text-muted-foreground mb-4">Recording in progress... Press stop when done (min {MIN_RECORDING_DURATION_SECONDS}s).</p>
                <button onClick={stopRecording} className="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-primary hover:bg-opacity-90 text-primary-foreground transition-colors">
                  <Square size={30} />
                </button>
              </>
            )}
            {recordingStatus === 'recorded' && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  {analyzing ? 'Analyzing your voice sample with KNN model...' : 'Recording complete. Voice screening is running automatically.'}
                </p>
                <audio src={audioUrl!} controls className="w-full" />
                
                {analyzing && analysisStep && (
                  <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <LoaderCircle className="animate-spin text-blue-400" size={18} />
                      <p className="text-sm text-blue-300">{analysisStep}</p>
                    </div>
                  </div>
                )}
                
                {!analyzing && !prediction && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={startRecording}
                      className="w-full bg-secondary text-secondary-foreground font-semibold p-3 rounded-lg"
                    >
                      Record Again
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={modelLoading || Boolean(modelError)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold p-3 rounded-lg flex items-center justify-center disabled:opacity-60"
                    >
                      <Scan size={18} className="mr-2" />
                      Re-run Voice Screening
                    </button>
                  </div>
                )}
                
                {prediction && (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={startRecording}
                      className="w-full bg-secondary text-secondary-foreground font-semibold p-3 rounded-lg"
                    >
                      Record New Sample
                    </button>
                  </div>
                )}
                {modelLoading && (
                  <p className="text-xs text-muted-foreground text-left">
                    Initialising KNN voice screening model...
                  </p>
                )}
                {modelMetadata && !modelLoading && !modelError && (
                  <div className="space-y-2">
                    <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
                      <p className="text-xs text-blue-300 text-left">
                        ✓ KNN model ready: {modelMetadata.sampleCount} real voice samples loaded 
                        (k={modelMetadata.k}
                        {modelMetadata.accuracy !== null ? `, ${(modelMetadata.accuracy * 100).toFixed(1)}% accuracy` : ''})
                      </p>
                      <p className="text-xs text-blue-400/80 text-left mt-1">
                        Voice screening uses real-time feature extraction and KNN algorithm with the actual dataset - no mock data.
                      </p>
                    </div>
                    <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
                      <p className="text-xs text-amber-300 text-left font-semibold">
                        ⚠️ Important Limitation
                      </p>
                      <p className="text-xs text-amber-400/90 text-left mt-1">
                        The training dataset was recorded with professional medical-grade equipment. Consumer microphones may produce different feature scales, potentially affecting prediction accuracy. Results are for demonstration purposes only - not for medical diagnosis.
                      </p>
                    </div>
                  </div>
                )}
                {modelError && (
                  <div className="flex items-center space-x-2 text-amber-400 bg-amber-900/20 p-3 rounded-lg">
                    <AlertCircle size={20} />
                    <p className="text-sm text-left">{modelError}</p>
                  </div>
                )}
                {analysisError && (
                  <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 p-3 rounded-lg">
                    <AlertCircle size={20} />
                    <p className="text-sm text-left">{analysisError}</p>
                  </div>
                )}
                {prediction && (
                  <div className="border border-emerald-700/40 bg-emerald-900/10 rounded-lg p-4 text-left">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Local screening</h4>
                    <p className="text-lg font-bold mt-2 capitalize">
                      {prediction.label === 'Parkinsons' ? `${deriveRiskLevel(prediction.probabilityOfParkinsons).toLowerCase()} risk detected` : 'Within healthy range'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Parkinson&apos;s probability {(prediction.probabilityOfParkinsons * 100).toFixed(1)}% using KNN (k={prediction.k}).
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      This automated screening is not a diagnosis. Share results with your clinician for confirmation.
                    </p>
                    {savingResult && (
                      <p className="text-xs text-muted-foreground mt-3 flex items-center">
                        <LoaderCircle className="animate-spin h-4 w-4 mr-2" /> Saving to dashboard...
                      </p>
                    )}
                    {saveMessage && !savingResult && (
                      <p className="text-xs text-emerald-300 mt-3">{saveMessage}</p>
                    )}
                    {prescription && (
                      <div className="mt-4 space-y-3">
                        <div>
                          <h5 className="text-sm font-semibold text-emerald-200">Prescription Summary</h5>
                          <p className="text-sm text-muted-foreground mt-1">{prescription.summary}</p>
                        </div>
                        <div>
                          <h5 className="text-sm font-semibold text-emerald-200">Observed Symptoms</h5>
                          <ul className="mt-1 space-y-1 list-disc list-inside text-sm text-muted-foreground">
                            {prescription.symptomFlags.map((flag, index) => (
                              <li key={index}>{flag}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-sm font-semibold text-emerald-200">Recommended Actions</h5>
                          <ul className="mt-1 space-y-1 list-disc list-inside text-sm text-muted-foreground">
                            {prescription.recommendations.map((item, index) => (
                              <li key={`rec-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    {featureVector && (
                      <div className="mt-4">
                        <h5 className="text-sm font-semibold text-emerald-200">Extracted Feature Values</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                          {Object.entries(featureVector).map(([key, value]) => (
                            <div key={key} className="flex justify-between bg-emerald-900/20 px-3 py-2 rounded">
                              <span className="font-medium mr-2">{formatFeatureLabel(key as keyof VoiceFeatureVector)}</span>
                              <span>{formatFeatureValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {error && (
              <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 p-3 rounded-lg mt-4">
                <AlertCircle size={20} />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
      </Card>
    </div>
  );
};

export default VoiceCaptureModal;
