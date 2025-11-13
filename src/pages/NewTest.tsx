import { useState } from 'react';
import Card from '../components/Card';
import { Upload, Mic, PenTool, Video } from 'lucide-react';
import UploadModal from '../components/UploadModal';
import VoiceCaptureModal from '../components/VoiceCaptureModal';
import ImageCaptureModal from '../components/ImageCaptureModal';

const testOptions = [
    { id: 'voice', title: 'Capture Voice', description: 'Record a 30-120s audio sample.', icon: Mic, type: 'speech' },
    { id: 'handwriting', title: 'Capture Handwriting', description: 'Photograph a spiral or wave drawing.', icon: PenTool, type: 'spiral' },
    { id: 'video', title: 'Capture Face Video', description: 'Record a 2-minute video for vitals estimation.', icon: Video, type: 'video' },
    { id: 'upload', title: 'Upload File', description: 'Upload an existing audio, image, or video file.', icon: Upload, type: 'upload' },
];

const NewTest = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeTestType, setActiveTestType] = useState<string>('upload');

  const openModal = (id: string, type: string) => {
      setActiveModal(id);
      setActiveTestType(type);
  }

  const closeModal = () => {
      setActiveModal(null);
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Start a New Test</h2>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Choose a method to provide data for analysis. Real-time capture provides the most accurate environmental data, but you can also upload existing files.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {testOptions.map(option => (
            <Card key={option.title} onClick={() => openModal(option.id, option.type)} className="text-center hover:border-primary transition-colors cursor-pointer">
                <option.icon className="h-12 w-12 mx-auto text-primary-foreground mb-4" />
                <h3 className="text-lg font-semibold">{option.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{option.description}</p>
            </Card>
        ))}
      </div>

      {activeModal === 'upload' && <UploadModal onClose={closeModal} />}
      {activeModal === 'voice' && <VoiceCaptureModal onClose={closeModal} />}
      {(activeModal === 'handwriting' || activeModal === 'video') && <ImageCaptureModal onClose={closeModal} testType={activeTestType} />}

    </div>
  );
};

export default NewTest;
