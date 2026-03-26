import { useState } from 'react';
import Card from '../components/Card';
import { Upload, Mic, Sparkles } from 'lucide-react';
import UploadModal from '../components/UploadModal';
import VoiceCaptureModal from '../components/VoiceCaptureModal';
import { motion } from 'framer-motion';

const testOptions = [
    { id: 'voice', title: 'Capture Voice', description: 'Record a 30-120s audio sample.', icon: Mic, type: 'speech', colorClass: 'text-primary bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground' },
    { id: 'upload-spiral', title: 'Upload Spiral', description: 'Upload a spiral drawing image.', icon: Upload, type: 'spiral', colorClass: 'text-secondary bg-secondary/10 group-hover:bg-secondary group-hover:text-secondary-foreground' },
    { id: 'upload-wave', title: 'Upload Wave', description: 'Upload a wave drawing image.', icon: Upload, type: 'wave', colorClass: 'text-primary bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground' },
];

const NewTest = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const openModal = (id: string, type: string) => {
      setActiveModal(id);
  }

  const closeModal = () => {
      setActiveModal(null);
  }

  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-3xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary/10 rounded-[2rem]">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-5xl font-serif font-bold text-foreground tracking-tight">Start a New Test</h2>
        </div>
        <p className="text-muted-foreground text-xl leading-relaxed">
          Choose a method to provide data for analysis. Real-time capture provides the most authentic tactile data, while uploading allows for historical processing.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {testOptions.map((option, index) => (
            <motion.div
              key={option.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
            >
              <Card 
                onClick={() => openModal(option.id, option.type)} 
                className={`text-center cursor-pointer p-8 group relative overflow-hidden rounded-organic-${(index % 4) + 1} bg-white/70 hover:border-primary/30 transition-all duration-500`}
              >
                <div className="relative z-10">
                  <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center mx-auto mb-8 transition-colors duration-400 ${option.colorClass}`}>
                    <option.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold mb-4 text-foreground group-hover:text-primary transition-colors">{option.title}</h3>
                  <p className="text-base font-medium text-muted-foreground leading-relaxed">{option.description}</p>
                </div>
              </Card>
            </motion.div>
        ))}
      </div>

      {activeModal === 'upload-spiral' && <UploadModal onClose={closeModal} uploadType="spiral" />}
      {activeModal === 'upload-wave' && <UploadModal onClose={closeModal} uploadType="wave" />}
      {activeModal === 'voice' && <VoiceCaptureModal onClose={closeModal} />}

    </div>
  );
};

export default NewTest;
