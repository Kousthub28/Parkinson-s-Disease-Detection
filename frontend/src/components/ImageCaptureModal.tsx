import { useState, useRef, useEffect } from 'react';
import Card from './Card';
import { Camera, X, LoaderCircle, AlertCircle, RefreshCw, Upload } from 'lucide-react';
import { mongodb } from '../lib/mongodbClient';
import { useAuth } from '../hooks/useAuth';
import { predictHandwriting, type HandwritingPrediction } from '../services/handwritingModel';
import { getModelAccuracy, getModelDisplay } from '../config/modelInfo';
import { insertTestRecord } from '../services/testPersistence';

const ImageCaptureModal = ({ onClose, testType }: { onClose: () => void, testType: string }) => {
  const [captureStatus, setCaptureStatus] = useState<'streaming' | 'captured'>('streaming');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [prediction, setPrediction] = useState<HandwritingPrediction | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);
  const { user } = useAuth();

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Camera access was denied. Please enable it in your browser settings.');
      console.error("Error accessing camera:", err);
    }
  };

  const stopStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        canvas.toBlob((blob) => {
          if (blob) {
            setImageBlob(blob);
            setImageUrl(URL.createObjectURL(blob));
            setCaptureStatus('captured');
            stopStream();
          }
        }, 'image/png');
      }
    }
  };

  const retake = () => {
    setCaptureStatus('streaming');
    setImageBlob(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setPrediction(null);
    setError(null);
    startStream();
  };

  const analyzeImage = async () => {
    if (!imageElementRef.current || testType === 'video') return;
    
    setAnalyzing(true);
    setError(null);
    setPrediction(null);
    
    try {
      // Determine model type based on test type
      const modelType = testType === 'spiral' ? 'spiral' : 'wave';
      
      // Run prediction using the trained H5 model
      const result = await predictHandwriting(imageElementRef.current, modelType);
      setPrediction(result);
    } catch (err: any) {
      setError(`Model prediction failed: ${err.message || 'Unknown error'}`);
      console.error('Prediction error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (imageUrl && imageElementRef.current && captureStatus === 'captured' && !prediction && !analyzing) {
      // Auto-analyze when image is loaded
      imageElementRef.current.onload = () => {
        analyzeImage();
      };
    }
  }, [imageUrl, captureStatus]);

  const handleUpload = async () => {
    if (!imageBlob || !user || !prediction) return;
    setProcessing(true);
    setError(null);
    setSuccess(false);
    try {
      let filePath = 'local-capture';
      
      // Try to upload the image to storage
      try {
        const fileName = `${user.id}-${Date.now()}.png`;
        filePath = `${testType}/${user.id}/${fileName}`;
        const uploadPromise = mongodb.storage.from('test_artifacts').upload(filePath, imageBlob);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 5000));
        const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]) as any;
        if (uploadError) filePath = 'local-capture';
      } catch {
        filePath = 'local-capture';
      }
      
      // Build Mongo insert payload without a custom id; backend generates ObjectId.
      const testRecord = {
        patient_id: user.id,
        test_type: testType,
        raw_storage_path: filePath,
        status: 'completed',
        created_at: new Date().toISOString(),
        result: {
          label: prediction.label,
          confidence: prediction.confidence,
          probabilities: prediction.probabilities,
          summary: (prediction as any).summary,
          modelUsed: testType,
          timestamp: new Date().toISOString(),
        },
        model_versions: {
          [testType]: testType === 'spiral' ? `MobileNetV2-${getModelAccuracy('spiral')}` : 'InceptionV3',
        },
        confidence: prediction.confidence,
      };

      let savedMongoId: string | null = null;
      const { id: mongoId, error: mongoErr } = await insertTestRecord(testRecord as Record<string, unknown>);
      if (mongoId) {
        savedMongoId = mongoId;
        console.log('✅ Camera capture saved to MongoDB');
      } else {
        console.warn('⚠️ MongoDB insert failed, local backup only:', mongoErr);
      }

      const localId = savedMongoId || `local-${Date.now()}`;
      const localRecord = { ...testRecord, id: localId };
      const localTests = JSON.parse(localStorage.getItem('local_tests') || '[]');
      localTests.unshift(localRecord);
      localStorage.setItem('local_tests', JSON.stringify(localTests));

      // Also write to `local_test_results` for screens that read that key.
      const localTestResults = JSON.parse(localStorage.getItem('local_test_results') || '[]');
      localTestResults.unshift(localRecord);
      localStorage.setItem('local_test_results', JSON.stringify(localTestResults));

      setSuccess(true);
    } catch (error: any) {
      // Even on error, try to save locally
      try {
        const testRecord = {
          id: `local-${Date.now()}`,
          patient_id: user.id,
          test_type: testType,
          raw_storage_path: 'local-capture',
          status: 'completed',
          created_at: new Date().toISOString(),
          result: {
            label: prediction.label,
            confidence: prediction.confidence,
            probabilities: prediction.probabilities,
            modelUsed: testType,
            timestamp: new Date().toISOString(),
          },
          confidence: prediction.confidence,
        };
        const localTests = JSON.parse(localStorage.getItem('local_tests') || '[]');
        localTests.unshift(testRecord);
        localStorage.setItem('local_tests', JSON.stringify(localTests));

        const localTestResults = JSON.parse(localStorage.getItem('local_test_results') || '[]');
        localTestResults.unshift(testRecord);
        localStorage.setItem('local_test_results', JSON.stringify(localTestResults));
        setSuccess(true);
      } catch {
        setError(error.message || 'An error occurred during upload.');
      }
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold capitalize">Capture {testType}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X /></button>
        </div>
        
        {success ? (
          <div className="text-center p-8">
            <h4 className="text-lg font-semibold text-green-400">Analysis Complete!</h4>
            {prediction && (
              <div className="mt-4 p-4 bg-secondary rounded-lg text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Result:</span>
                  <span className={`font-bold ${prediction.label === 'Healthy' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {prediction.label}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Confidence:</span>
                  <span className="font-bold">{(prediction.confidence * 100).toFixed(2)}%</span>
                </div>
                <div className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">
                  <p><strong>Model Used:</strong> {prediction.modelUsed === 'spiral' ? `${getModelDisplay('spiral')} accuracy` : 'VGG16'}</p>
                </div>
              </div>
            )}
            <p className="text-muted-foreground mt-4">Your test result has been saved to your dashboard.</p>
            <button onClick={onClose} className="mt-4 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg">Close</button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                {captureStatus === 'streaming' && <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>}
                {captureStatus === 'captured' && imageUrl && (
                  <img ref={imageElementRef} src={imageUrl} alt="Captured" className="w-full h-full object-contain" />
                )}
                <canvas ref={canvasRef} className="hidden"></canvas>
            </div>

            {analyzing && (
              <div className="flex items-center justify-center space-x-2 text-primary p-3 bg-primary/10 rounded-lg">
                <LoaderCircle className="animate-spin" size={20} />
                <p className="text-sm font-semibold">Running MobileNetV2 model analysis...</p>
              </div>
            )}

            {prediction && !analyzing && (
              <div className="p-4 bg-secondary rounded-lg text-left space-y-2">
                <h4 className="font-semibold text-lg mb-3">AI Analysis Result</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background p-3 rounded">
                    <p className="text-xs text-muted-foreground">Prediction</p>
                    <p className={`text-lg font-bold ${prediction.label === 'Healthy' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {prediction.label}
                    </p>
                  </div>
                  <div className="bg-background p-3 rounded">
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-lg font-bold">{(prediction.confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>
                {prediction.reasoning && (
                  <div className="bg-background p-3 rounded mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Clinical Reasoning</p>
                    <p className="text-sm">{prediction.reasoning}</p>
                  </div>
                )}
                <div className="bg-background p-3 rounded mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Probabilities</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Parkinson's:</span>
                      <span className="font-semibold">{(prediction.probabilities.Parkinsons * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Healthy:</span>
                      <span className="font-semibold">{(prediction.probabilities.Healthy * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-background p-3 rounded">
                  <strong>Model:</strong> {prediction.modelUsed === 'spiral' ? `${getModelDisplay('spiral')} test accuracy` : 'VGG16'}
                </div>
              </div>
            )}

            {captureStatus === 'streaming' && (
                <button onClick={captureImage} className="mx-auto flex items-center justify-center w-16 h-16 rounded-full border-4 border-white bg-primary/50 hover:bg-primary/80 transition-colors">
                    <Camera size={32} className="text-white" />
                </button>
            )}
            
            {captureStatus === 'captured' && (
              <div className="flex space-x-4">
                  <button onClick={retake} className="w-full bg-secondary text-secondary-foreground font-semibold p-3 rounded-lg flex items-center justify-center">
                    <RefreshCw size={18} className="mr-2" /> Retake
                  </button>
                  <button 
                    onClick={handleUpload} 
                    disabled={processing || analyzing || !prediction} 
                    className="w-full bg-primary text-primary-foreground font-semibold p-3 rounded-lg flex items-center justify-center disabled:opacity-50"
                  >
                      {processing ? (
                        <LoaderCircle className="animate-spin" />
                      ) : analyzing ? (
                        <>Analyzing...</>
                      ) : (
                        <><Upload size={18} className="mr-2"/> Save Result</>
                      )}
                  </button>
              </div>
            )}

            {error && (
              <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 p-3 rounded-lg mt-4">
                <AlertCircle size={20} />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ImageCaptureModal;
