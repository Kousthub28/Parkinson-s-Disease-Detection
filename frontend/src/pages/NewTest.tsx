import { useMemo, useState } from 'react';
import Card from '../components/Card';
import { Upload, Mic, Sparkles, Gamepad2, Eye } from 'lucide-react';
import UploadModal from '../components/UploadModal';
import VoiceCaptureModal from '../components/VoiceCaptureModal';
import MotorGame from '../components/MotorGame';
import EyeMovementModal from '../components/EyeMovementModal';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const newTestCopy = {
  en: {
    title: 'Start a New Test',
    description: 'Choose a method to provide data for analysis. Live capture is best for real-time movement signals, while uploads help process existing recordings and drawings.',
    tryNow: 'Try now',
    options: {
      voice: {
        title: 'Capture Voice',
        description: 'Record a 30-120 second audio sample.',
      },
      spiral: {
        title: 'Upload Spiral',
        description: 'Upload a spiral drawing image.',
      },
      wave: {
        title: 'Upload Wave',
        description: 'Upload a wave drawing image.',
      },
      motor: {
        title: 'Motor Skill Test',
        description: 'Get a 5-second buffer, then 20 seconds to trace and evaluate motor control.',
      },
      eyeMovement: {
        title: 'Eye Movement Test',
        description: 'Follow a guided target for 20 seconds so the system can analyze gaze shifts, blinking, and fixation control.',
      },
    },
  },
  kn: {
    title: 'ಹೊಸ ಪರೀಕ್ಷೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ',
    description: 'ವಿಶ್ಲೇಷಣೆಗೆ ಡೇಟಾ ನೀಡುವ ವಿಧಾನವನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಲೈವ್ ಕ್ಯಾಪ್ಚರ್ ನೇರ ಚಲನ ಸಂಕೇತಗಳಿಗೆ ಉತ್ತಮ, ಅಪ್‌ಲೋಡ್ ಆಯ್ಕೆ ಈಗಿರುವ ದಾಖಲೆಗಳು ಮತ್ತು ಚಿತ್ರಗಳನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ಉಪಯುಕ್ತವಾಗಿದೆ.',
    tryNow: 'ಈಗ ಪ್ರಯತ್ನಿಸಿ',
    options: {
      voice: {
        title: 'ಧ್ವನಿಯನ್ನು ದಾಖಲಿಸಿ',
        description: '30-120 ಸೆಕೆಂಡ್ ಧ್ವನಿ ಮಾದರಿಯನ್ನು ದಾಖಲಿಸಿ.',
      },
      spiral: {
        title: 'ಸ್ಪೈರಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
        description: 'ಸ್ಪೈರಲ್ ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
      },
      wave: {
        title: 'ಅಲೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
        description: 'ಅಲೆ ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
      },
      motor: {
        title: 'ಚಲನ ಕೌಶಲ್ಯ ಪರೀಕ್ಷೆ',
        description: 'ಮೊದಲು 5 ಸೆಕೆಂಡ್ ಸಿದ್ಧತೆ, ನಂತರ 20 ಸೆಕೆಂಡ್ ಟ್ರೇಸ್ ಮಾಡಿ ಚಲನ ನಿಯಂತ್ರಣವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ.',
      },
      eyeMovement: {
        title: 'ಕಣ್ಣಿನ ಚಲನ ಪರೀಕ್ಷೆ',
        description: '20 ಸೆಕೆಂಡ್ ಮಾರ್ಗದರ್ಶಿತ ಗುರಿಯನ್ನು ಅನುಸರಿಸಿ ದೃಷ್ಟಿ ಬದಲಾವಣೆ, ಮಿಟುಕಿಸುವಿಕೆ ಮತ್ತು ಸ್ಥಿರ ದೃಷ್ಟಿ ನಿಯಂತ್ರಣವನ್ನು ಪರಿಶೀಲಿಸಿ.',
      },
    },
  },
} as const;

const drawingGuideCopy = {
  en: {
    title: 'Drawing reference',
    description: 'Use a plain sheet and a dark pen. Keep the drawing centered, clear, and fill a good part of the photo.',
    spiralTitle: 'Spiral drawing',
    spiralBody: 'Draw one continuous spiral from the center outward. Avoid tracing over the same line.',
    waveTitle: 'Wave drawing',
    waveBody: 'Draw a repeating wave from left to right in one smooth line.',
    uploadSpiral: 'Upload spiral',
    uploadWave: 'Upload wave',
  },
  kn: {
    title: 'Drawing reference',
    description: 'Use a plain sheet and a dark pen. Keep the drawing centered, clear, and fill a good part of the photo.',
    spiralTitle: 'Spiral drawing',
    spiralBody: 'Draw one continuous spiral from the center outward. Avoid tracing over the same line.',
    waveTitle: 'Wave drawing',
    waveBody: 'Draw a repeating wave from left to right in one smooth line.',
    uploadSpiral: 'Upload spiral',
    uploadWave: 'Upload wave',
  },
} as const;

const svgToImage = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const buildSpiralReferenceImage = () => {
  const center = 120;
  const points = Array.from({ length: 260 }, (_, index) => {
    const progress = index / 259;
    const angle = progress * Math.PI * 2 * 5.2;
    const radius = 6 + progress * 88;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return svgToImage(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="8" fill="#ffffff"/>
      <path d="M24 48H216M24 96H216M24 144H216M24 192H216M48 24V216M96 24V216M144 24V216M192 24V216" stroke="#e9e2d8" stroke-width="1"/>
      <polyline points="${points}" fill="none" stroke="#202020" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="120" cy="120" r="3" fill="#202020"/>
    </svg>
  `);
};

const SPIRAL_REFERENCE_IMAGE = buildSpiralReferenceImage();
const WAVE_REFERENCE_IMAGE = svgToImage(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180">
    <rect width="360" height="180" rx="8" fill="#ffffff"/>
    <path d="M24 45H336M24 90H336M24 135H336M60 24V156M120 24V156M180 24V156M240 24V156M300 24V156" stroke="#e9e2d8" stroke-width="1"/>
    <path d="M26 90 C52 30 82 30 108 90 S164 150 190 90 S246 30 272 90 S328 150 354 90" fill="none" stroke="#202020" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`);

type DrawingReferenceProps = {
  image: string;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
};

const DrawingReference = ({ image, title, body, action, onClick }: DrawingReferenceProps) => (
  <div className="overflow-hidden rounded-lg border border-border/50 bg-background/70 shadow-sm">
    <div className="bg-white p-1.5">
      <img src={image} alt={title} className="h-14 w-full object-contain" />
    </div>
    <div className="space-y-1.5 border-t border-border/40 p-2.5">
      <div>
        <h4 className="text-[13px] font-serif font-bold text-foreground">{title}</h4>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {action}
      </button>
    </div>
  </div>
);

const NewTest = () => {
  const { language } = useLanguage();
  const copy = newTestCopy[language];
  const guideCopy = drawingGuideCopy[language];
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const testOptions = useMemo(
    () => [
      {
        id: 'voice',
        title: copy.options.voice.title,
        description: copy.options.voice.description,
        icon: Mic,
        colorClass: 'text-primary bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground',
      },
      {
        id: 'upload-spiral',
        title: copy.options.spiral.title,
        description: copy.options.spiral.description,
        icon: Upload,
        colorClass: 'text-secondary bg-secondary/10 group-hover:bg-secondary group-hover:text-secondary-foreground',
      },
      {
        id: 'upload-wave',
        title: copy.options.wave.title,
        description: copy.options.wave.description,
        icon: Upload,
        colorClass: 'text-primary bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground',
      },
      {
        id: 'motor-game',
        title: copy.options.motor.title,
        description: copy.options.motor.description,
        icon: Gamepad2,
        colorClass: 'text-accent-foreground bg-accent-foreground/10 group-hover:bg-accent-foreground group-hover:text-background',
      },
      {
        id: 'eye-movement',
        title: copy.options.eyeMovement.title,
        description: copy.options.eyeMovement.description,
        icon: Eye,
        colorClass: 'text-secondary bg-secondary/10 group-hover:bg-secondary group-hover:text-secondary-foreground',
      },
    ],
    [copy],
  );

  const openModal = (id: string) => {
    setActiveModal(id);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-4xl"
      >
        <div>
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-[2rem] bg-primary/10 p-3">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-5xl font-serif font-bold tracking-tight text-foreground">{copy.title}</h2>
          </div>
          <p className="text-xl leading-relaxed text-muted-foreground">{copy.description}</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.06, ease: 'easeOut' }}
        className="max-w-4xl rounded-lg border border-border/50 bg-white/60 p-2 shadow-sm"
      >
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-serif font-bold text-foreground">{guideCopy.title}</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{guideCopy.description}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <DrawingReference
              image={SPIRAL_REFERENCE_IMAGE}
              title={guideCopy.spiralTitle}
              body={guideCopy.spiralBody}
              action={guideCopy.uploadSpiral}
              onClick={() => openModal('upload-spiral')}
            />
            <DrawingReference
              image={WAVE_REFERENCE_IMAGE}
              title={guideCopy.waveTitle}
              body={guideCopy.waveBody}
              action={guideCopy.uploadWave}
              onClick={() => openModal('upload-wave')}
            />
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {testOptions.map((option, index) => (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
            className="h-full"
          >
            <Card
              onClick={() => openModal(option.id)}
              className={`group relative h-full min-h-[22rem] cursor-pointer overflow-hidden rounded-organic-${(index % 4) + 1} bg-white/70 p-8 text-center transition-all duration-500 hover:border-primary/30`}
            >
              <div className="relative z-10 flex h-full flex-col items-center justify-center">
                <div className={`mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-[2rem] transition-colors duration-400 ${option.colorClass}`}>
                  <option.icon className="h-8 w-8" />
                </div>
                {(option.id === 'motor-game' || option.id === 'eye-movement') && (
                  <span className="mb-3 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                    {copy.tryNow}
                  </span>
                )}
                <h3 className="mb-4 text-2xl font-serif font-bold text-foreground transition-colors group-hover:text-primary">
                  {option.title}
                </h3>
                <p className="max-w-[15rem] text-base font-medium leading-relaxed text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {activeModal === 'upload-spiral' && <UploadModal onClose={closeModal} uploadType="spiral" />}
      {activeModal === 'upload-wave' && <UploadModal onClose={closeModal} uploadType="wave" />}
      {activeModal === 'voice' && <VoiceCaptureModal onClose={closeModal} />}
      {activeModal === 'motor-game' && <MotorGame onClose={closeModal} />}
      {activeModal === 'eye-movement' && <EyeMovementModal onClose={closeModal} />}
    </div>
  );
};

export default NewTest;
