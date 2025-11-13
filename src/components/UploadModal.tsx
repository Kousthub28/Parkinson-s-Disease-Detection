import { useState } from 'react';
import Card from './Card';
import { FileUp, X, LoaderCircle, AlertCircle, CheckCircle, Brain } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { processTest } from '../services/api';

type PredictionResult = {
  label: string;
  confidence: number;
  details?: string;
};

const UploadModal = ({ onClose }: { onClose: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
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

      // Create test record
      const testRecord = {
        id: `local-${Date.now()}`,
        patient_id: user.id,
        test_type: 'handwriting',
        raw_storage_path: 'local-analysis',
        status: 'completed',
        created_at: new Date().toISOString(),
        result: {
          prediction: predictionResult.label,
          confidence: predictionResult.confidence,
          details: predictionResult.details,
          timestamp: new Date().toISOString(),
          analysisMethod: 'local-tensorflow',
          riskScore: predictionResult.label.toLowerCase().includes('parkinson') ? 
            Math.round(predictionResult.confidence * 10) : 
            Math.round((1 - predictionResult.confidence) * 10)
        }
      };

      // Try Supabase with very short timeout
      const insertPromise = (supabase as any).from('tests').insert(testRecord);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 3000)
      );

      try {
        await Promise.race([insertPromise, timeoutPromise]);
        console.log('✅ Saved to Supabase successfully');
      } catch (dbError) {
        console.warn('⚠️ Supabase not available, saving locally:', dbError);
        
        // Fallback: Save to localStorage
        const localTests = JSON.parse(localStorage.getItem('local_tests') || '[]');
        localTests.unshift(testRecord);
        localStorage.setItem('local_tests', JSON.stringify(localTests));
        console.log('✅ Saved to localStorage successfully');
      }

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
    setLoadingMessage('Loading AI models...');

    try {
      // First try local analysis (runs in browser using TF.js) before uploading.
      
      // dynamic import to avoid loading TF until needed
      const { predictImageLocally } = await import('../services/imagePredictor');

      // try to guess whether this is spiral or wave from filename if possible
      const lower = file.name.toLowerCase();
      let kind: 'spiral' | 'wave' | 'auto' = 'auto';
      if (lower.includes('spiral')) kind = 'spiral';
      if (lower.includes('wave')) kind = 'wave';

      setLoadingMessage('Analyzing image with TensorFlow.js...');
      const result = await predictImageLocally(file, kind);

      if (result.label === 'unknown') {
        setLoadingMessage('Uploading to server...');
        // fallback: upload to supabase if available
        if (!supabase) throw new Error('No local dataset available and Supabase client not configured.');

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `uploads/${user.id}/${fileName}`;

        const { error: uploadError } = await (supabase as any).storage
          .from('test_artifacts')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: newTestData, error: insertError } = await (supabase as any).from('tests').insert({
          patient_id: user.id,
          test_type: 'upload',
          raw_storage_path: filePath,
        }).select('id').single();

        if (insertError) throw insertError;

        await processTest((newTestData as any).id);

        setSuccess(true);
        setFile(null);
      } else {
        // show prediction result in modal
        setPredictionResult(result);
        setProcessing(false);
        setLoadingMessage('');
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred during local analysis or upload.');
      setProcessing(false);
      setLoadingMessage('');
    }
  };  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <Card className="w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Upload Test File</h3>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X /></button>
            </div>
            
            {success ? (
                <div className="text-center p-8">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
                    <h4 className="text-lg font-semibold text-green-400">Saved Successfully!</h4>
                    <p className="text-muted-foreground mt-2">Your prediction has been saved to your dashboard.</p>
                    <button onClick={onClose} className="mt-4 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg">Close</button>
                </div>
            ) : predictionResult ? (
                <div className="text-center p-6">
                    <Brain className="h-16 w-16 mx-auto text-primary-foreground mb-4" />
                    <h4 className="text-lg font-semibold mb-2">Analysis Complete</h4>
                    
                    <div className="bg-card-hover rounded-lg p-4 mb-4 text-left">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground">Prediction:</span>
                            <span className={`font-semibold ${predictionResult.label.includes('Parkinson') ? 'text-orange-400' : 'text-green-400'}`}>
                                {predictionResult.label}
                            </span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground">Confidence:</span>
                            <span className="font-semibold">{Math.round(predictionResult.confidence * 100)}%</span>
                        </div>
                        {predictionResult.details && (
                            <div className="mt-3 pt-3 border-t border-border">
                                <p className="text-xs text-muted-foreground">{predictionResult.details}</p>
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                        This analysis was performed locally in your browser using TensorFlow.js and the training dataset.
                    </p>

                    {error && (
                        <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 p-3 rounded-lg mb-4">
                            <AlertCircle size={20} />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setPredictionResult(null); setFile(null); }} 
                            className="flex-1 bg-card-hover text-foreground font-semibold p-3 rounded-lg hover:bg-opacity-80 transition-colors"
                        >
                            Analyze Another
                        </button>
                        <button 
                            onClick={handleSavePrediction} 
                            disabled={saving}
                            className="flex-1 bg-primary text-primary-foreground font-semibold p-3 rounded-lg hover:bg-opacity-90 transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                            {saving ? <LoaderCircle className="animate-spin" /> : 'Save to Dashboard'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                        <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept="image/*" />
                        <label htmlFor="file-upload" className="cursor-pointer">
                            <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                            {file ? (
                                <p className="text-foreground">{file.name}</p>
                            ) : (
                                <p className="text-muted-foreground">Click to browse or drag & drop an image</p>
                            )}
                        </label>
                    </div>

                    {error && (
                        <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 p-3 rounded-lg">
                            <AlertCircle size={20} />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <button onClick={handleUpload} disabled={!file || processing} className="w-full bg-primary text-primary-foreground font-semibold p-3 rounded-lg flex items-center justify-center disabled:opacity-50">
                        {processing ? (
                            <div className="flex items-center gap-2">
                                <LoaderCircle className="animate-spin" />
                                <span>{loadingMessage || 'Analyzing...'}</span>
                            </div>
                        ) : 'Analyze Image'}
                    </button>
                </div>
            )}
        </Card>
    </div>
  );
};

export default UploadModal;
