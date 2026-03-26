import type { ExerciseDefinition } from './therapyTypes';
import './exerciseAnimations.css';

interface ExerciseVisualProps {
  exercise: ExerciseDefinition | null;
}

const photoLabelMap: Record<NonNullable<ExerciseDefinition['id']>, string> = {
  'seated-hand-raise': 'Exercise: Raise both hands above shoulder level while seated',
  'finger-tapping': 'Exercise: Make rapid up-down tapping motions with hands',
  'arm-stability': 'Exercise: Hold both arms outstretched at shoulder height',
  'seated-march': 'Exercise: Touch opposite shoulder with each hand alternately',
};

const ExerciseVisual = ({ exercise }: ExerciseVisualProps) => {
  if (!exercise) {
    return (
      <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-[linear-gradient(160deg,rgba(93,112,82,0.12),rgba(193,140,93,0.12),rgba(255,255,255,0.92))] p-5">
        <div className="aspect-[4/3] rounded-[1.25rem] border border-dashed border-border/80 bg-white/55" />
        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">Exercise photo will appear here</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-[linear-gradient(155deg,rgba(193,140,93,0.18),rgba(93,112,82,0.14),rgba(255,255,255,0.96))] p-4">
      <div className="overflow-hidden rounded-[1.25rem] border border-white/70 bg-[#F8F3EA] shadow-inner">
        <svg
          viewBox="0 0 320 240"
          className="h-auto w-full"
          role="img"
          aria-label={photoLabelMap[exercise.id]}
        >
          <defs>
            <linearGradient id="therapy-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F7F0E4" />
              <stop offset="100%" stopColor="#E6DCCD" />
            </linearGradient>
          </defs>
          <rect width="320" height="240" fill="url(#therapy-bg)" />
          <rect x="22" y="24" width="276" height="192" rx="26" fill="#FBF8F1" stroke="#D8CFC1" strokeWidth="2" />
          {/* Chair */}
          <rect x="204" y="114" width="44" height="54" rx="6" fill="#DCCAB8" opacity="0.8" />
          <rect x="208" y="86" width="36" height="30" rx="6" fill="#EFE3D5" />
          <rect x="54" y="182" width="210" height="10" rx="5" fill="#D0C5B4" />
          {/* Head */}
          <circle cx="160" cy="70" r="20" fill="#D8A27D" />
          {/* Body */}
          <rect x="143" y="90" width="34" height="44" rx="14" fill="#5D7052" />

          {exercise.id === 'seated-hand-raise' && (
            <>
              {/* Arms raised above shoulders - animated */}
              <g className="animate-arm-raise" style={{ transformOrigin: '160px 98px' }}>
                <line x1="150" y1="98" x2="126" y2="46" stroke="#D8A27D" strokeWidth="10" strokeLinecap="round" />
                <line x1="170" y1="98" x2="194" y2="46" stroke="#D8A27D" strokeWidth="10" strokeLinecap="round" />
                {/* Arrow indicators showing upward motion */}
                <polygon points="126,38 120,50 132,50" fill="#5D7052" opacity="0.7" />
                <polygon points="194,38 188,50 200,50" fill="#5D7052" opacity="0.7" />
              </g>
              {/* Legs on chair */}
              <line x1="149" y1="132" x2="138" y2="182" stroke="#89674E" strokeWidth="12" strokeLinecap="round" />
              <line x1="171" y1="132" x2="182" y2="182" stroke="#89674E" strokeWidth="12" strokeLinecap="round" />
              <rect x="118" y="150" width="84" height="12" rx="4" fill="#C18C5D" />
              <rect x="126" y="160" width="8" height="28" rx="4" fill="#B17A4A" />
              <rect x="186" y="160" width="8" height="28" rx="4" fill="#B17A4A" />
            </>
          )}
          {exercise.id === 'finger-tapping' && (
            <>
              {/* Arms with tapping motion - animated */}
              <g className="animate-finger-tap" style={{ transformOrigin: '160px 108px' }}>
                <line x1="150" y1="100" x2="118" y2="116" stroke="#D8A27D" strokeWidth="10" strokeLinecap="round" />
                <line x1="170" y1="100" x2="202" y2="116" stroke="#D8A27D" strokeWidth="10" strokeLinecap="round" />
                <circle cx="112" cy="118" r="7" fill="#D8A27D" />
                <circle cx="208" cy="118" r="7" fill="#D8A27D" />
              </g>
              {/* Motion lines */}
              <line x1="106" y1="108" x2="106" y2="128" stroke="#5D7052" strokeWidth="2" strokeDasharray="4,3" opacity="0.6" />
              <line x1="214" y1="108" x2="214" y2="128" stroke="#5D7052" strokeWidth="2" strokeDasharray="4,3" opacity="0.6" />
              <line x1="149" y1="132" x2="142" y2="182" stroke="#89674E" strokeWidth="12" strokeLinecap="round" />
              <line x1="171" y1="132" x2="178" y2="182" stroke="#89674E" strokeWidth="12" strokeLinecap="round" />
            </>
          )}
          {exercise.id === 'arm-stability' && (
            <>
              {/* Arms held steady with subtle stability pulse - animated */}
              <g className="animate-arm-stability" style={{ transformOrigin: '160px 102px' }}>
                <line x1="150" y1="102" x2="100" y2="102" stroke="#D8A27D" strokeWidth="10" strokeLinecap="round" />
                <line x1="170" y1="102" x2="220" y2="102" stroke="#D8A27D" strokeWidth="10" strokeLinecap="round" />
                {/* Stability indicator */}
                <line x1="96" y1="96" x2="96" y2="108" stroke="#5D7052" strokeWidth="2" opacity="0.5" />
                <line x1="224" y1="96" x2="224" y2="108" stroke="#5D7052" strokeWidth="2" opacity="0.5" />
              </g>
              <line x1="149" y1="132" x2="141" y2="182" stroke="#89674E" strokeWidth="12" strokeLinecap="round" />
              <line x1="171" y1="132" x2="179" y2="182" stroke="#89674E" strokeWidth="12" strokeLinecap="round" />
            </>
          )}
          {exercise.id === 'seated-march' && (
            <>
              {/* Arms crossing with alternating motion - animated */}
              <g className="animate-seated-march" style={{ transformOrigin: '160px 100px' }}>
                {/* Right arm crossing to left shoulder */}
                <line x1="170" y1="100" x2="142" y2="96" stroke="#D8A27D" strokeWidth="10" strokeLinecap="round" />
                {/* Left arm at rest */}
                <line x1="150" y1="100" x2="120" y2="124" stroke="#D8A27D" strokeWidth="10" strokeLinecap="round" />
                {/* Cross arrow */}
                <path d="M 185 88 Q 162 78 145 90" stroke="#5D7052" strokeWidth="2" fill="none" strokeDasharray="5,3" opacity="0.7" />
                <polygon points="145,88 141,94 149,93" fill="#5D7052" opacity="0.7" />
              </g>
              {/* Legs */}
              <line x1="149" y1="132" x2="142" y2="182" stroke="#89674E" strokeWidth="12" strokeLinecap="round" />
              <line x1="171" y1="132" x2="178" y2="182" stroke="#89674E" strokeWidth="12" strokeLinecap="round" />
              <rect x="118" y="150" width="84" height="12" rx="4" fill="#C18C5D" />
              <rect x="126" y="160" width="8" height="28" rx="4" fill="#B17A4A" />
              <rect x="186" y="160" width="8" height="28" rx="4" fill="#B17A4A" />
            </>
          )}
        </svg>
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">Reference photo</p>
      <p className="mt-1 text-sm text-muted-foreground">{photoLabelMap[exercise.id]}</p>
    </div>
  );
};

export default ExerciseVisual;
