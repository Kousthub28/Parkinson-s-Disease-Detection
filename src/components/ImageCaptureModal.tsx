import { useState, useRef, useEffect } from 'react';
import Card from './Card';
import { Camera, X, LoaderCircle, AlertCircle, RefreshCw, Upload } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { processTest } from '../services/api';

const ImageCaptureModal = ({ onClose, testType }: { onClose: () => void, testType: string }) => {
  const [captureStatus, setCaptureStatus] = useState<'streaming' | 'captured'>('streaming');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    startStream();
  };

  const handleUpload = async () => {
    if (!imageBlob || !user) return;
    setProcessing(true);
    setError(null);
    setSuccess(false);
    try {
      const fileName = `${user.id}-${Date.now()}.png`;
      const filePath = `${testType}/${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('test_artifacts').upload(filePath, imageBlob);
      if (uploadError) throw uploadError;
      const { data: newTestData, error: insertError } = await supabase.from('tests').insert({
        patient_id: user.id,
        test_type: testType,
        raw_storage_path: filePath,
      }).select('id').single();
      if (insertError) throw insertError;
      await processTest(newTestData.id);
      setSuccess(true);
    } catch (error: any) {
      setError(error.message || 'An error occurred during upload.');
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
            <h4 className="text-lg font-semibold text-green-400">Processing Started!</h4>
            <p className="text-muted-foreground mt-2">Your image has been sent for analysis. Results will appear on your dashboard shortly.</p>
            <button onClick={onClose} className="mt-4 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg">Close</button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                {captureStatus === 'streaming' && <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>}
                {captureStatus === 'captured' && imageUrl && <img src={imageUrl} alt="Captured" className="w-full h-full object-contain" />}
                <canvas ref={canvasRef} className="hidden"></canvas>
            </div>

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
                  <button onClick={handleUpload} disabled={processing} className="w-full bg-primary text-primary-foreground font-semibold p-3 rounded-lg flex items-center justify-center disabled:opacity-50">
                      {processing ? <LoaderCircle className="animate-spin" /> : <><Upload size={18} className="mr-2"/> Upload for Analysis</>}
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
