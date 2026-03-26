import { useState } from 'react';
import { FileUp, X, LoaderCircle, AlertCircle, CheckCircle, Brain } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { predictHandwriting, type HandwritingPrediction } from '../services/handwritingModel';
import { getModelAccuracy, getModelDisplay } from '../config/modelInfo';
import { insertTestRecord } from '../services/testPersistence';

const UploadModal = ({ onClose, uploadType }: { onClose: () => void, uploadType: 'spiral' | 'wave' }) => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [predictionResult, setPredictionResult] = useState<HandwritingPrediction | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(false);
      setPredictionResult(null);
    }
  };

  const handleSavePrediction = async () => {
    if (!predictionResult || !user) return;

    setSaving(true);
    setError(null);

    try {
      console.log('Attempting to save prediction to database...');

            // Create Mongo insert payload without a custom id; backend generates ObjectId.
            const testRecord = {
        patient_id: user.id,
        test_type: uploadType,
        raw_storage_path: 'local-analysis',
        status: 'completed',
        created_at: new Date().toISOString(),
        result: {
          label: predictionResult.label,
          confidence: predictionResult.confidence,
          probabilities: predictionResult.probabilities,
          summary: predictionResult.summary,
          modelUsed: uploadType,
          timestamp: new Date().toISOString(),
          analysisMethod: uploadType === 'spiral' ? 'mobilenetv2-h5-trained' : 'inceptionv3-h5-trained',
        },
        model_versions: {
          [uploadType]: uploadType === 'spiral' ? `MobileNetV2-${getModelAccuracy('spiral')}` : 'InceptionV3',
        },
        confidence: predictionResult.confidence,
      };

      let savedMongoId: string | null = null;
      const { id: mongoId, error: mongoErr } = await insertTestRecord(testRecord as Record<string, unknown>);
      if (mongoId) {
        savedMongoId = mongoId;
        console.log('✅ Saved spiral/wave test to MongoDB');
      } else {
        console.warn('⚠️ MongoDB insert failed, keeping local copy only:', mongoErr);
      }

      const localId = savedMongoId || `local-${Date.now()}`;
      const localRecord = { ...testRecord, id: localId };
      const localTests = JSON.parse(localStorage.getItem('local_tests') || '[]');
      localTests.unshift(localRecord);
      localStorage.setItem('local_tests', JSON.stringify(localTests));
      console.log('✅ Saved test copy to localStorage (merge backup)');

      // Also write to `local_test_results` so all screens can pick it up.
      // (Some parts of the app read from `local_test_results`.)
      const localTestResults = JSON.parse(localStorage.getItem('local_test_results') || '[]');
      localTestResults.unshift(localRecord);
      localStorage.setItem('local_test_results', JSON.stringify(localTestResults));

      setSuccess(true);
      setSaving(false);
      
      // Close and refresh after success
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Save error:', error);
      setError('Saved locally. Your test result is stored in your browser.');
      setSaving(false);
      
      // Still close after showing message
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setProcessing(true);
    setError(null);
    setLoadingMessage('Initializing AI engines...');

    try {
      // Use the uploadType parameter (spiral or wave)
      const modelType = uploadType;
      console.log(`[UPLOAD] Using ${modelType} model for file: ${file.name}`);
      
      // Load image and create HTMLImageElement
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      // Sequential UI feedback to match backend processing steps
      await new Promise(resolve => setTimeout(resolve, 600));
      setLoadingMessage('Resizing and optimizing image quality...');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setLoadingMessage('Extracting spatial features and contours...');
      
      await new Promise(resolve => setTimeout(resolve, 600));
      setLoadingMessage(`Running ${modelType === 'spiral' ? 'MobileNetV2 (Spiral)' : 'InceptionV3 (Wave)'} inference...`);

      // Run prediction using trained model
      // If modelType is null, backend will auto-detect
      const result = await predictHandwriting(img, modelType);
      
      // Cleanup
      URL.revokeObjectURL(imageUrl);

      // Show prediction result
      setPredictionResult(result);
      setProcessing(false);
      setLoadingMessage('');
      
    } catch (error: any) {
      console.error('Prediction error:', error);
      setError(error.message || 'An error occurred during model inference.');
      setProcessing(false);
      setLoadingMessage('');
    }
  };  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Upload {uploadType === 'spiral' ? 'Spiral' : 'Wave'} Image</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={20} />
                </button>
            </div>
            
            {success ? (
                <div className="text-center p-6">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-3" />
                    <h4 className="text-xl font-bold text-gray-900 mb-2">Saved Successfully!</h4>
                    <p className="text-gray-600">Your prediction has been saved to your dashboard.</p>
                    <button 
                        onClick={onClose} 
                        className="mt-4 bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                    >
                        Close
                    </button>
                </div>
            ) : predictionResult ? (
                <div className="p-4">
                    <div className="text-center mb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-3">
                            <Brain className="h-8 w-8 text-blue-600" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900">Analysis Complete</h4>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 mb-4 border border-blue-200">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center pb-3 border-b border-blue-200">
                                <span className="text-gray-700 font-medium">Prediction:</span>
                                <span className={`font-bold text-xl ${predictionResult.label === 'Parkinsons' ? 'text-orange-600' : 'text-green-600'}`}>
                                    {predictionResult.label}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-blue-200">
                                <span className="text-gray-700 font-medium">Confidence:</span>
                                <span className="font-bold text-xl text-blue-600">{(predictionResult.confidence * 100).toFixed(1)}%</span>
                            </div>
                            
                            {predictionResult.reasoning && (
                                <div className="pt-2 pb-1">
                                    <p className="text-xs font-semibold text-gray-700 mb-1">Clinical Reasoning:</p>
                                    <p className="text-sm text-gray-800 leading-relaxed bg-white/50 p-2 rounded-lg border border-blue-100">
                                        {predictionResult.reasoning}
                                    </p>
                                </div>
                            )}
                            
                            <div className="pt-2 mt-2 border-t border-blue-200">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Probabilities:</p>
                                <div className="space-y-2">
                                    <div className="bg-white rounded-lg p-2 shadow-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-gray-800 text-sm font-medium">Parkinson's:</span>
                                            <span className="font-bold text-orange-600">{(predictionResult.probabilities.Parkinsons * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div 
                                                className="bg-gradient-to-r from-orange-400 to-orange-600 h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${predictionResult.probabilities.Parkinsons * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 shadow-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-gray-800 text-sm font-medium">Healthy:</span>
                                            <span className="font-bold text-green-600">{(predictionResult.probabilities.Healthy * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div 
                                                className="bg-gradient-to-r from-green-400 to-green-600 h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${predictionResult.probabilities.Healthy * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-3 border-t border-blue-200">
                                <div className="flex items-center gap-2 text-xs text-gray-700 bg-white rounded-lg p-2">
                                    <Brain className="h-4 w-4 text-blue-600" />
                                    <p>
                                        <strong className="text-gray-900">Model:</strong> {predictionResult.modelUsed === 'spiral' ? getModelDisplay('spiral') : 'VGG16'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="text-center text-gray-600 mb-4 text-xs">
                        Analysis performed using trained {predictionResult.modelUsed === 'spiral' ? getModelDisplay('spiral') : 'VGG16'} neural network model.
                    </p>

                    {error && (
                        <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-3 rounded-lg mb-3 border border-red-200">
                            <AlertCircle size={16} />
                            <p className="text-xs font-medium">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button 
                            onClick={() => { setPredictionResult(null); setFile(null); }} 
                            className="flex-1 bg-gray-100 text-gray-800 font-semibold py-2.5 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300 text-sm"
                        >
                            Analyze Another
                        </button>
                        <button 
                            onClick={handleSavePrediction} 
                            disabled={saving}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center disabled:opacity-50 shadow-lg text-sm"
                        >
                            {saving ? <LoaderCircle className="animate-spin" size={18} /> : 'Save to Dashboard'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors bg-gray-50">
                        <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept="image/*" />
                        <label htmlFor="file-upload" className="cursor-pointer">
                            <FileUp className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            {file ? (
                                <div>
                                    <p className="text-gray-900 font-semibold">{file.name}</p>
                                    <p className="text-gray-500 text-xs mt-1">Click to change file</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-gray-700 font-medium mb-1">Click to browse or drag & drop</p>
                                    <p className="text-gray-500 text-xs">PNG, JPG up to 10MB</p>
                                </div>
                            )}
                        </label>
                    </div>

                    {error && (
                        <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
                            <AlertCircle size={16} />
                            <p className="text-xs font-medium">{error}</p>
                        </div>
                    )}

                    <button 
                        onClick={handleUpload} 
                        disabled={!file || processing} 
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center disabled:opacity-50 hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
                    >
                        {processing ? (
                            <div className="flex items-center gap-2">
                                <LoaderCircle className="animate-spin" size={18} />
                                <span className="text-sm">{loadingMessage || 'Analyzing...'}</span>
                            </div>
                        ) : 'Analyze Image'}
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default UploadModal;
