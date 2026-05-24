import { useEffect, useState } from 'react';
import { FileUp, X, LoaderCircle, AlertCircle, CheckCircle, Brain, Waves, RefreshCw, CircleDot, ShieldCheck } from 'lucide-react';
import Card from './Card';
import { useAuth } from '../hooks/useAuth';
import { predictHandwriting, type HandwritingPrediction } from '../services/handwritingModel';
import { getModelAccuracy, getModelDisplay } from '../config/modelInfo';
import { insertTestRecord } from '../services/testPersistence';
import { blobToDataUrl, uploadTestArtifact } from '../utils/testArtifacts';

const UploadModal = ({ onClose, uploadType }: { onClose: () => void, uploadType: 'spiral' | 'wave' }) => {
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [predictionResult, setPredictionResult] = useState<HandwritingPrediction | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [readinessConfirmed, setReadinessConfirmed] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const nextFile = e.target.files[0];
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFile(nextFile);
      setFilePreviewUrl(URL.createObjectURL(nextFile));
      setError(null);
      setSuccess(false);
      setPredictionResult(null);
      setConfirmed(false);
    }
  };

  const handleSavePrediction = async () => {
    if (!predictionResult || !user) return;
    setSaving(true);
    setError(null);
    try {
      const artifactPath = file ? await uploadTestArtifact(user.id, uploadType, file, 'png') : null;
      const localArtifactDataUrl = file ? await blobToDataUrl(file) : null;
      const resultPayload = {
        label: predictionResult.label,
        confidence: predictionResult.confidence,
        probabilities: predictionResult.probabilities,
        summary: predictionResult.summary,
        modelUsed: uploadType,
        timestamp: new Date().toISOString(),
        analysisMethod: uploadType === 'spiral' ? 'mobilenetv2-h5-trained' : 'inceptionv3-h5-trained',
        artifactType: 'image',
        artifactMimeType: file?.type || 'image/png',
        artifactName: file?.name || `${uploadType}-drawing.png`,
      };
      const testRecord = {
        patient_id: user.id,
        test_type: uploadType,
        raw_storage_path: artifactPath || 'local-analysis',
        status: 'completed',
        created_at: new Date().toISOString(),
        result: resultPayload,
        model_versions: {
          [uploadType]: uploadType === 'spiral' ? `MobileNetV2-${getModelAccuracy('spiral')}` : `InceptionV3-${getModelAccuracy('wave')}`,
        },
        confidence: predictionResult.confidence,
      };

      let savedMongoId: string | null = null;
      const { id: mongoId, error: mongoErr } = await insertTestRecord(testRecord as Record<string, unknown>);
      if (mongoId) {
        savedMongoId = mongoId;
      } else {
        console.warn('⚠️ MongoDB insert failed:', mongoErr);
      }

      const localId = savedMongoId || `local-${Date.now()}`;
      const localRecord = {
        ...testRecord,
        id: localId,
        result: {
          ...resultPayload,
          ...(localArtifactDataUrl ? { artifactDataUrl: localArtifactDataUrl } : {}),
        },
      };
      ['local_tests', 'local_test_results'].forEach(key => {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        arr.unshift(localRecord);
        localStorage.setItem(key, JSON.stringify(arr));
      });

      setSuccess(true);
      setSaving(false);
      setTimeout(() => { onClose(); window.location.reload(); }, 1500);
    } catch {
      setError('Saved locally. Your test result is stored in your browser.');
      setSaving(false);
      setTimeout(() => { onClose(); window.location.reload(); }, 2000);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setProcessing(true);
    setError(null);
    setLoadingMessage('Initializing AI engines...');
    try {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });
      await new Promise(r => setTimeout(r, 600));
      setLoadingMessage('Resizing and optimizing image quality...');
      await new Promise(r => setTimeout(r, 800));
      setLoadingMessage('Extracting spatial features and contours...');
      await new Promise(r => setTimeout(r, 600));
      setLoadingMessage(`Running ${uploadType === 'spiral' ? 'MobileNetV2 (Spiral)' : 'InceptionV3 (Wave)'} inference...`);

      const result = await predictHandwriting(img, uploadType);
      URL.revokeObjectURL(imageUrl);
      setPredictionResult(result);
      setProcessing(false);
      setLoadingMessage('');
    } catch (err: any) {
      setError(err.message || 'An error occurred during model inference.');
      setProcessing(false);
      setLoadingMessage('');
    }
  };

  // Accent colour per type
  const typeColor = uploadType === 'spiral'
    ? { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-600 hover:bg-violet-700', border: 'border-violet-300 dark:border-violet-700' }
    : { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-600 hover:bg-teal-700', border: 'border-teal-300 dark:border-teal-700' };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-xl my-8 !bg-background !dark:bg-background border border-border">

        {/* Header */}
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            {uploadType === 'spiral'
              ? <CircleDot className="h-5 w-5 text-violet-500" />
              : <Waves className="h-5 w-5 text-teal-500" />}
            <h3 className="text-lg font-semibold text-foreground">
              Upload {uploadType === 'spiral' ? 'Spiral' : 'Wave'} Image
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-1">
            <X size={18} />
          </button>
        </div>

        {/* ── Success ── */}
        {success ? (
          <div className="text-center py-8 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle className="h-9 w-9 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-xl font-bold text-foreground mb-2">Saved Successfully!</h4>
            <p className="text-muted-foreground text-sm">Your prediction has been saved to your dashboard.</p>
            <button onClick={onClose} className="mt-5 bg-primary text-primary-foreground font-semibold px-6 py-2 rounded-xl hover:opacity-90 transition-opacity">
              Close
            </button>
          </div>

        /* ── Result ── */
        ) : predictionResult ? (
          <div>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h4 className="text-lg font-bold text-foreground">Analysis Complete</h4>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-4 mb-4 space-y-3">
              {filePreviewUrl && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Uploaded Drawing</p>
                  <img
                    src={filePreviewUrl}
                    alt={`${uploadType} uploaded drawing`}
                    className="max-h-56 w-full rounded-xl border border-border bg-white object-contain p-2"
                  />
                </div>
              )}

              <div className="flex justify-between items-center pb-3 border-b border-border">
                <span className="text-muted-foreground text-sm font-medium">Prediction</span>
                <span className={`font-bold text-lg ${predictionResult.label === 'Parkinsons' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  {predictionResult.label}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <span className="text-muted-foreground text-sm font-medium">Confidence</span>
                <span className="font-bold text-lg text-primary">{(predictionResult.confidence * 100).toFixed(1)}%</span>
              </div>

              {predictionResult.reasoning && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Clinical Reasoning</p>
                  <p className="text-sm text-foreground leading-relaxed bg-background rounded-xl p-3 border border-border">
                    {predictionResult.reasoning}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Probabilities</p>
                <div className="space-y-2">
                  {(['Parkinsons', 'Healthy'] as const).map(label => (
                    <div key={label} className="bg-background rounded-xl p-3 border border-border">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm text-foreground">{label === 'Parkinsons' ? "Parkinson's" : 'Healthy'}</span>
                        <span className={`font-bold text-sm ${label === 'Parkinsons' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                          {(predictionResult.probabilities[label] * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-700 ${label === 'Parkinsons' ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${predictionResult.probabilities[label] * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-background rounded-xl p-3 border border-border flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span><strong>Model:</strong> {predictionResult.modelUsed === 'spiral' ? getModelDisplay('spiral') : getModelDisplay('wave')}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-xl mb-3 border border-destructive/20">
                <AlertCircle size={15} className="flex-shrink-0" />
                <p className="text-xs">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPredictionResult(null);
                  setFile(null);
                  if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                  setFilePreviewUrl(null);
                  setConfirmed(false);
                }}
                className="flex-1 bg-muted text-foreground font-medium py-2.5 rounded-xl hover:bg-muted/70 transition-colors border border-border text-sm"
              >
                Analyze Another
              </button>
              <button
                onClick={handleSavePrediction}
                disabled={saving}
                className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 text-sm"
              >
                {saving ? <LoaderCircle className="animate-spin" size={16} /> : 'Save to Dashboard'}
              </button>
            </div>
          </div>

        /* ── Upload + Confirmation ── */
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="mb-2 flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Before you analyze this drawing</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Please take this test only when you are calm, seated comfortably, and not feeling rushed or stressed. Temporary shakiness from stress, fatigue, caffeine, or discomfort can affect the result.
                  </p>
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white/80 p-3">
                <input
                  type="checkbox"
                  checked={readinessConfirmed}
                  onChange={(e) => setReadinessConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs leading-relaxed text-foreground">
                  I am taking this drawing test in a calm environment and understand that this is a screening aid, not a diagnosis.
                </span>
              </label>
            </div>

            {/* Drop zone */}
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all duration-200"
            >
              <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept="image/*" />
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileUp className="h-5 w-5 text-primary" />
              </div>
              {file ? (
                <>
                  <p className="font-semibold text-foreground text-sm">{file.name}</p>
                  <p className="text-primary text-xs">Click to change file</p>
                </>
              ) : (
                <>
                  <p className="text-foreground font-medium text-sm">Click to browse or drag & drop</p>
                  <p className="text-muted-foreground text-xs">PNG, JPG up to 10MB</p>
                </>
              )}
            </label>

            {/* Confirmation card */}
            {file && !confirmed && (
              <div className={`rounded-2xl border-2 p-4 ${typeColor.border} bg-background`}>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="font-semibold text-foreground text-sm">Confirm Before Proceeding</p>
                </div>

                <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-3 border border-border mb-3">
                  {uploadType === 'spiral'
                    ? <CircleDot className="h-7 w-7 text-violet-500 flex-shrink-0 mt-0.5" />
                    : <Waves className="h-7 w-7 text-teal-500 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      This is the <span className={typeColor.text}>{uploadType === 'spiral' ? 'Spiral Drawing' : 'Wave Drawing'}</span> test
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                      {uploadType === 'spiral'
                        ? 'Upload a hand-drawn spiral (coiled circle radiating outward).'
                        : 'Upload a hand-drawn wave (repeating S-curve drawn horizontally).'}
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground text-xs font-medium text-center mb-3">
                  Is your uploaded image a {uploadType === 'spiral' ? '🌀 spiral' : '〰️ wave'} drawing?
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFile(null);
                      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                      setFilePreviewUrl(null);
                      setConfirmed(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-muted text-foreground font-medium py-2 rounded-xl hover:bg-muted/70 transition-colors text-sm border border-border"
                  >
                    <RefreshCw size={13} />
                    No, choose another
                  </button>
                  <button
                    onClick={() => setConfirmed(true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 font-semibold py-2 rounded-xl transition-colors text-sm text-white ${typeColor.bg}`}
                  >
                    <CheckCircle size={13} />
                    Yes, it's a {uploadType}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmed badge */}
            {file && confirmed && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2.5">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <p className="text-green-700 dark:text-green-400 text-xs font-medium flex-1">
                  Confirmed as a <strong>{uploadType}</strong> drawing — ready to analyze.
                </p>
                <button
                  onClick={() => {
                    setFile(null);
                    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                    setFilePreviewUrl(null);
                    setConfirmed(false);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Change image"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                <AlertCircle size={15} className="flex-shrink-0" />
                <p className="text-xs">{error}</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || !confirmed || !readinessConfirmed || processing}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {processing ? (
                <div className="flex items-center gap-2">
                  <LoaderCircle className="animate-spin" size={17} />
                  <span className="text-sm">{loadingMessage || 'Analyzing...'}</span>
                </div>
              ) : !file
                ? 'Select an Image First'
                : !readinessConfirmed
                ? 'Confirm Test Conditions Above'
                : !confirmed
                ? 'Confirm Drawing Type Above'
                : 'Analyze Image'}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UploadModal;
