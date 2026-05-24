import { Link } from 'react-router-dom';
import {
  Mic, PenLine, Activity, FileText, MessageSquare,
  CalendarCheck, ArrowRight, Waves, CircleDot,
  TrendingUp, Mail, ShieldCheck, BrainCircuit, CheckCircle, Leaf, Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

/* ─── Design Tokens (Botanical / Organic Serif) ───────────────────────────── */
const C = {
  bg:          '#F9F8F4', // Warm Alabaster
  fg:          '#2D3A31', // Deep Forest Green
  primary:     '#8C9A84', // Sage Green
  clay:        '#DCCFC2', // Soft Clay / Mushroom
  border:      '#E6E2DA', // Stone
  terracotta:  '#C27B66', // Interactive / CTA pop
  muted:       '#6E7D6C', // Muted text
} as const;

/* ─── Shared animation helpers ────────────────────────────────────────────── */
const floatUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.75, delay, ease: 'easeOut' as const },
});

/* ─── Sub-components ──────────────────────────────────────────────────────── */

/** Mandatory paper grain texture overlay */
const GrainTexture = () => (
  <div
    className="pointer-events-none fixed inset-0 z-50 opacity-[0.018]"
    aria-hidden="true"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat',
    }}
  />
);

/** Decorative fine vine line between sections */
const VineLine = () => (
  <div className="flex items-center justify-center py-8">
    <svg className="w-48 h-8 opacity-30" viewBox="0 0 192 32" fill="none">
      <path
        d="M 0 16 C 32 4, 64 28, 96 16 C 128 4, 160 28, 192 16"
        stroke={C.primary}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="96" cy="16" r="2.5" fill={C.primary} opacity="0.5" />
    </svg>
  </div>
);

/** Playfair Display heading — the typographic protagonist */
const Heading = ({
  as: Tag = 'h2', children, className = '', color,
}: {
  as?: 'h1' | 'h2' | 'h3'; children: React.ReactNode; className?: string; color?: string;
}) => (
  <Tag
    className={className}
    style={{ fontFamily: "'Playfair Display', Georgia, serif", color: color ?? C.fg }}
  >
    {children}
  </Tag>
);

/** Source Sans 3 body text */
const Body = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={className} style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", color: C.muted }}>
    {children}
  </p>
);

/** Pill badge */
const PillBadge = ({ children }: { children: React.ReactNode }) => (
  <span
    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest px-5 py-2 rounded-full border"
    style={{ borderColor: C.primary, color: C.primary, fontFamily: "'Source Sans 3', sans-serif" }}
  >
    {children}
  </span>
);

/** Primary pill button — Deep Forest Green */
const BtnPrimary = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="group inline-flex items-center gap-2 rounded-full px-9 py-4 font-semibold uppercase tracking-widest text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all duration-300"
    style={{
      background: C.fg,
      color: '#fff',
      fontFamily: "'Source Sans 3', sans-serif",
      boxShadow: `0 10px 30px -8px rgba(45,58,49,0.25)`,
    }}
  >
    {children}
    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" strokeWidth={1.5} />
  </Link>
);

/** Secondary outline button — Sage border */
const BtnSecondary = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    className="inline-flex items-center gap-2 rounded-full px-9 py-4 font-semibold uppercase tracking-widest text-sm border hover:bg-opacity-5 transition-all duration-300"
    style={{ borderColor: C.primary, color: C.primary, fontFamily: "'Source Sans 3', sans-serif" }}
  >
    {children}
  </a>
);

/** Feature card with organic stagger option */
const FeatureCard = ({
  icon: Icon, title, description, stagger = false, delay,
}: {
  icon: React.ElementType; title: string; description: string; stagger?: boolean; delay: number;
}) => (
  <motion.div
    {...floatUp(delay)}
    whileHover={{ y: -6, transition: { duration: 0.4, ease: 'easeOut' as const } }}
    className={`group bg-white rounded-3xl p-8 border transition-all duration-500 ${stagger ? 'md:translate-y-12' : ''}`}
    style={{
      borderColor: C.border,
      boxShadow: '0 4px 6px -1px rgba(45,58,49,0.05)',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = '0 25px 50px -12px rgba(45,58,49,0.15)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 6px -1px rgba(45,58,49,0.05)';
    }}
  >
    {/* Icon — floating in a pale sage circle */}
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110"
      style={{ background: `${C.primary}15` }}
    >
      <Icon className="h-6 w-6" style={{ color: C.primary }} strokeWidth={1.5} />
    </div>
    <h3
      className="text-xl font-semibold mb-3 leading-snug"
      style={{ fontFamily: "'Playfair Display', serif", color: C.fg }}
    >
      {title}
    </h3>
    <Body className="text-sm leading-relaxed">{description}</Body>
  </motion.div>
);

/* ─── Main Landing Page ───────────────────────────────────────────────────── */
const Landing = () => {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: C.bg }}>
      <GrainTexture />

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between backdrop-blur-sm border-b"
        style={{ background: `${C.bg}e0`, borderColor: C.border }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: C.fg }}
          >
            <BrainCircuit className="h-4 w-4 text-white" strokeWidth={1.5} />
          </div>
          <span
            className="font-semibold text-xl tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: C.fg }}
          >
            NeuroCare
          </span>
        </div>

        <div
          className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest font-medium"
          style={{ fontFamily: "'Source Sans 3', sans-serif", color: C.muted }}
        >
          <a href="#features" className="hover:opacity-70 transition-opacity duration-300">Features</a>
          <a href="#process" className="hover:opacity-70 transition-opacity duration-300">How It Works</a>
          <a href="#care" className="hover:opacity-70 transition-opacity duration-300">Care</a>
        </div>

        <Link
          to="/login"
          className="text-sm font-semibold uppercase tracking-widest rounded-full px-6 py-2.5 transition-all duration-300 hover:opacity-90"
          style={{
            fontFamily: "'Source Sans 3', sans-serif",
            background: C.fg,
            color: '#fff',
          }}
        >
          Sign In
        </Link>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-28 pb-32 max-w-7xl mx-auto">
        {/* Oversized ambient watercolour blobs */}
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] pointer-events-none"
          style={{ background: C.primary }}
        />
        <div
          className="absolute bottom-0 -left-24 w-[400px] h-[400px] rounded-full opacity-15 blur-[100px] pointer-events-none"
          style={{ background: C.terracotta }}
        />

        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' as const }}
            className="mb-8"
          >
            <PillBadge><Leaf className="h-3 w-3" strokeWidth={1.5} /> Multi-modal AI · Clinical Fusion Reports</PillBadge>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' as const }}
          >
            <Heading as="h1" className="text-5xl md:text-7xl lg:text-8xl leading-[1.05] tracking-tight mb-8">
              Detect Parkinson's{' '}
              <br />
              <em style={{ color: C.primary, fontStyle: 'italic' }}>Earlier.</em>
              {' '}Live{' '}
              <em style={{ color: C.terracotta, fontStyle: 'italic' }}>Better.</em>
            </Heading>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.3, ease: 'easeOut' as const }}
            className="mb-12 max-w-2xl mx-auto"
          >
            <Body className="text-lg md:text-xl leading-relaxed">
              NeuroCare fuses{' '}
              <span style={{ color: C.fg, fontWeight: 500 }}>voice, spiral & wave drawings, and motor skill</span>{' '}
              tests into a single AI Fusion Report — delivered instantly to your inbox, free of charge.
            </Body>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: 'easeOut' as const }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <BtnPrimary to="/login">Begin Free Screening</BtnPrimary>
            <BtnSecondary href="#features">Explore Features</BtnSecondary>
          </motion.div>
        </div>

        {/* Arch decorative elements — botanical windows */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: 'easeOut' as const }}
          className="relative mt-24 flex items-end justify-center gap-6"
        >
          {[
            { label: '4+ Modalities', sub: 'Voice · Spiral · Wave · Motor', bg: `${C.primary}18`, color: C.fg },
            { label: 'Fusion Score', sub: '0–10 Risk Scale', bg: `${C.terracotta}18`, color: C.fg, tall: true },
            { label: 'Email Reports', sub: 'Auto-sent at no cost', bg: `${C.clay}60`, color: C.fg },
          ].map(({ label, sub, bg, color, tall }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 + i * 0.1, ease: 'easeOut' as const }}
              className="flex flex-col items-center justify-end px-8 py-10 text-center border"
              style={{
                background: bg,
                borderColor: C.border,
                height: tall ? 200 : 160,
                width: 160,
                borderRadius: '9999px 9999px 24px 24px', // arch shape
              }}
            >
              <p className="font-semibold text-base mb-1" style={{ fontFamily: "'Playfair Display', serif", color }}>
                {label}
              </p>
              <p className="text-xs uppercase tracking-widest" style={{ fontFamily: "'Source Sans 3', sans-serif", color: C.muted }}>
                {sub}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <VineLine />

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-32 max-w-7xl mx-auto">
        <motion.div {...floatUp(0)} className="text-center mb-20 max-w-2xl mx-auto">
          <PillBadge><BrainCircuit className="h-3 w-3" strokeWidth={1.5} /> What's Built</PillBadge>
          <Heading as="h2" className="text-4xl md:text-5xl mt-6 mb-5 leading-tight">
            Six Modules,{' '}
            <em style={{ color: C.primary, fontStyle: 'italic' }}>One Picture</em>
          </Heading>
          <Body className="text-lg leading-relaxed">
            Every test runs a purpose-built AI model. Every result feeds into your unified clinical Fusion Report.
          </Body>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Mic, stagger: false,
              title: 'Voice Analysis',
              description: 'Record a 30–120s voice sample. The AI detects tremor, breathiness, and pitch irregularities — biomarkers closely linked to early Parkinson\'s onset.',
            },
            {
              icon: CircleDot, stagger: true,
              title: 'Spiral Drawing Test',
              description: 'Upload a hand-drawn spiral. MobileNetV2 classifies pen-stroke regularity and tremor response with clinical-grade pattern recognition accuracy.',
            },
            {
              icon: Waves, stagger: false,
              title: 'Wave Drawing Test',
              description: 'Upload a wave drawing. InceptionV3 evaluates horizontal stroke consistency, deviation, and rhythm — a sensitive and objective motor biomarker.',
            },
            {
              icon: Activity, stagger: false,
              title: 'Motor Skill Test',
              description: 'A 20-second on-screen tracing task captures fine motor control directly in the browser. No wearables or external hardware required.',
            },
            {
              icon: FileText, stagger: true,
              title: 'AI Fusion Report',
              description: 'All four scores merge via a weighted ensemble model into one Risk Score (0–10) with Risk Level and Confidence %. Saved permanently to your history.',
            },
            {
              icon: Mail, stagger: false,
              title: 'Email Report Delivery',
              description: 'The moment your Fusion Report generates, a detailed HTML clinical summary — your vitals, BMI, and AI scores — is dispatched to your inbox automatically.',
            },
          ].map((f, i) => (
            <FeatureCard key={f.title} delay={i * 0.08} {...f} />
          ))}
        </div>
      </section>

      <VineLine />

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section
        id="process"
        className="py-32 px-6"
        style={{ background: `${C.clay}30` }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div {...floatUp(0)} className="text-center mb-20 max-w-xl mx-auto">
            <PillBadge><PenLine className="h-3 w-3" strokeWidth={1.5} /> The Process</PillBadge>
            <Heading as="h2" className="text-4xl md:text-5xl mt-6 mb-5 leading-tight">
              Minutes to Your{' '}
              <em style={{ color: C.terracotta, fontStyle: 'italic' }}>Report</em>
            </Heading>
          </motion.div>

          <div className="relative grid md:grid-cols-3 gap-12 md:gap-8">
            {/* Decorative curved connector */}
            <svg className="hidden md:block absolute top-16 left-[20%] right-[20%] w-3/5 h-8 pointer-events-none" viewBox="0 0 600 32" preserveAspectRatio="none">
              <path
                d="M 0 16 C 100 0, 200 32, 300 16 C 400 0, 500 32, 600 16"
                stroke={C.border}
                strokeWidth="1.5"
                strokeDasharray="6 5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            {[
              {
                step: '01', icon: ShieldCheck, title: 'Create Your Profile',
                desc: 'Sign up with email or Google. Enter your age, gender, height, and weight — BMI auto-calculates and is stored for all your reports.',
              },
              {
                step: '02', icon: PenLine, title: 'Run Your Tests',
                desc: 'Complete any combination of Voice, Spiral, Wave, and Motor tests. Upload images or record live from the browser.',
              },
              {
                step: '03', icon: FileText, title: 'Receive Your Report',
                desc: 'Your Fusion Report is generated and emailed instantly. Review it anytime in History or share with your neurologist.',
              },
            ].map(({ step, icon: Icon, title, desc }, i) => (
              <motion.div key={step} {...floatUp(i * 0.18)} className="flex flex-col items-center text-center relative z-10">
                {/* Arch-shaped icon container */}
                <div
                  className="w-24 h-28 flex items-end justify-center pb-5 mb-6 border"
                  style={{
                    borderColor: C.border,
                    background: '#fff',
                    borderRadius: '9999px 9999px 20px 20px',
                    boxShadow: '0 10px 30px -8px rgba(45,58,49,0.08)',
                  }}
                >
                  <Icon className="h-8 w-8" style={{ color: C.primary }} strokeWidth={1.5} />
                </div>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-3 px-3 py-1 rounded-full border"
                  style={{ borderColor: C.border, color: C.muted, fontFamily: "'Source Sans 3', sans-serif" }}
                >
                  Step {step}
                </div>
                <Heading as="h3" className="text-xl mb-3">{title}</Heading>
                <Body className="text-sm leading-relaxed max-w-xs">{desc}</Body>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <VineLine />

      {/* ── FULL CARE PLATFORM ───────────────────────────────────────────── */}
      <section id="care" className="px-6 py-32 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text column */}
          <motion.div {...floatUp(0)}>
            <PillBadge><Leaf className="h-3 w-3" strokeWidth={1.5} /> Full Care Platform</PillBadge>
            <Heading as="h2" className="text-4xl md:text-5xl mt-6 mb-6 leading-tight">
              Screening is Only{' '}
              <em style={{ color: C.primary, fontStyle: 'italic' }}>the Beginning</em>
            </Heading>
            <Body className="text-lg leading-relaxed mb-10">
              NeuroCare is a complete companion for living with and managing Parkinson's — from first detection to daily wellness.
            </Body>

            <div className="space-y-4">
              {[
                { icon: TrendingUp, title: 'History & Tracking', desc: 'Every test result stored. Track your risk trajectory over time and share progress with clinicians.' },
                { icon: CalendarCheck, title: 'Doctor Booking', desc: 'Book appointments with approved neurologists directly inside the app without leaving NeuroCare.' },
                { icon: MessageSquare, title: 'AI Chatbot', desc: "Powered by OpenRouter. Ask anything about medications, your results, or living well with Parkinson's." },
                { icon: BrainCircuit, title: 'AI Therapy', desc: 'Personalised cognitive and physical exercises generated by AI for your current risk stage.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div key={title} {...floatUp(i * 0.1)} className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${C.primary}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: C.primary }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-0.5" style={{ fontFamily: "'Playfair Display', serif", color: C.fg }}>
                      {title}
                    </p>
                    <Body className="text-sm leading-relaxed">{desc}</Body>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Visual column — Trust points in arch composition */}
          <motion.div {...floatUp(0.2)} className="relative hidden lg:block">
            {/* Large central arch */}
            <div
              className="mx-auto w-72 h-96 flex flex-col items-center justify-end pb-10 px-8 text-center border relative overflow-hidden"
              style={{
                background: `linear-gradient(180deg, ${C.primary}18 0%, #fff 60%)`,
                borderColor: C.border,
                borderRadius: '9999px 9999px 40px 40px',
                boxShadow: '0 20px 60px -15px rgba(45,58,49,0.12)',
              }}
            >
              {/* Decorative circle at top */}
              <div
                className="absolute top-10 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: `${C.primary}18` }}
              >
                <BrainCircuit className="h-10 w-10" style={{ color: C.primary }} strokeWidth={1.2} />
              </div>
              <div className="mt-24">
                <Heading as="h3" className="text-3xl mb-2">Fusion<br /><em style={{ color: C.primary, fontStyle: 'italic' }}>Report</em></Heading>
                <p className="text-xs uppercase tracking-widest" style={{ color: C.muted, fontFamily: "'Source Sans 3', sans-serif" }}>
                  Voice · Spiral · Wave · Motor
                </p>
              </div>
            </div>

            {/* Floating trust chips */}
            {[
              { label: '0–10 Risk Score', top: '10%', right: '-5%', bg: '#fff' },
              { label: 'Free Email Delivery', top: '40%', left: '-5%', bg: '#fff' },
              { label: 'Auto-saved to History', bottom: '15%', right: '-5%', bg: '#fff' },
            ].map(({ label, ...pos }) => (
              <div
                key={label}
                className="absolute px-4 py-2.5 rounded-full border text-xs font-semibold shadow-md"
                style={{
                  ...pos,
                  borderColor: C.border,
                  background: '#fff',
                  color: C.fg,
                  fontFamily: "'Source Sans 3', sans-serif",
                  boxShadow: '0 6px 20px -4px rgba(45,58,49,0.12)',
                }}
              >
                {label}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <VineLine />

      {/* ── TRUST SECTION ────────────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: `${C.clay}20` }}>
        <div className="max-w-5xl mx-auto">
          <motion.div {...floatUp(0)} className="text-center mb-14">
            <PillBadge><ShieldCheck className="h-3 w-3" strokeWidth={1.5} /> Built with Care</PillBadge>
            <Heading as="h2" className="text-4xl md:text-5xl mt-6 mb-4">Trustworthy by Design</Heading>
          </motion.div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[
              'Free to use — no subscriptions or paywalls',
              'Clinical AI models trained on Parkinson\'s datasets',
              'All modalities fuse into a single weighted Fusion Score',
              'Reports auto-emailed — no manual download needed',
              'Firebase authentication — secure & private',
              'Results stored in MongoDB, never sold or shared',
            ].map((item, i) => (
              <motion.div key={i} {...floatUp(i * 0.07)} className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${C.primary}18` }}
                >
                  <CheckCircle className="h-3.5 w-3.5" style={{ color: C.primary }} strokeWidth={2} />
                </div>
                <p className="text-sm leading-relaxed" style={{ fontFamily: "'Source Sans 3', sans-serif", color: C.muted }}>
                  {item}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-32 max-w-5xl mx-auto">
        <motion.div
          {...floatUp(0)}
          className="relative overflow-hidden rounded-[2.5rem] p-14 lg:p-20 text-center"
          style={{
            background: C.fg,
            boxShadow: '0 30px 80px -20px rgba(45,58,49,0.3)',
          }}
        >
          {/* Interior blobs */}
          <div
            className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ background: C.primary }}
          />
          <div
            className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ background: C.terracotta }}
          />
          {/* Paper grain inside CTA */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative z-10">
            <Sparkles className="h-8 w-8 mx-auto mb-5" style={{ color: C.primary }} />
            <Heading as="h2" color="#F9F8F4" className="text-4xl md:text-6xl leading-tight mb-6">
              Begin Your Screening{' '}
              <em style={{ color: C.primary, fontStyle: 'italic' }}>Today</em>
            </Heading>
            <p className="text-lg mb-10 max-w-xl mx-auto leading-relaxed" style={{ fontFamily: "'Source Sans 3', sans-serif", color: `${C.clay}` }}>
              No hardware. No subscription. A complete clinical Fusion Report emailed to you in minutes, completely free.
            </p>
            <Link
              to="/login"
              className="group inline-flex items-center gap-2.5 rounded-full px-10 py-4 font-semibold uppercase tracking-widest text-sm transition-all duration-300 hover:opacity-90 active:scale-95"
              style={{
                background: C.bg,
                color: C.fg,
                fontFamily: "'Source Sans 3', sans-serif",
                boxShadow: `0 8px 30px -8px rgba(0,0,0,0.3)`,
              }}
            >
              Begin Free Screening
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" strokeWidth={1.5} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t px-6 py-10" style={{ borderColor: C.border }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.fg }}>
              <BrainCircuit className="h-3.5 w-3.5 text-white" strokeWidth={1.5} />
            </div>
            <span className="font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: C.fg }}>NeuroCare</span>
          </div>
          <p className="text-xs text-center" style={{ fontFamily: "'Source Sans 3', sans-serif", color: C.muted }}>
            © {new Date().getFullYear()} NeuroCare · AI-assisted Parkinson's screening
          </p>
          <p className="text-xs text-center sm:text-right" style={{ fontFamily: "'Source Sans 3', sans-serif", color: C.muted }}>
            Not a substitute for clinical diagnosis
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
