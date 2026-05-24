import { useState, useEffect, useEffectEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, LoaderCircle, Mail, Lock, User, CheckCircle, Sparkles,
  Calendar, Activity, Ruler, Building2, Phone, BriefcaseMedical, IdCard,
  GraduationCap, Briefcase, BrainCircuit,
} from 'lucide-react';
import { mongodb } from '../lib/mongodbClient';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import { getDashboardRouteForRole } from '../services/healthcareApi';
import type { AppUser, UserRole } from '../types/healthcare';
import type { Profile } from '../types/database';
import { signInWithPopup, type User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const GOOGLE_SIGN_IN_ROLE_KEY = 'google_sign_in_role';

type GoogleOnboardingState = {
  email: string;
  role: UserRole;
};

const isPatientProfileComplete = (profile: Profile | null | undefined) => Boolean(
  profile?.full_name &&
  profile?.phone &&
  profile?.gender &&
  profile?.date_of_birth &&
  profile?.weightKg !== null &&
  profile?.weightKg !== undefined &&
  profile?.heightCm !== null &&
  profile?.heightCm !== undefined,
);

const isDoctorProfileComplete = (appUser: AppUser | null | undefined) => Boolean(
  appUser?.full_name &&
  appUser?.phone &&
  appUser?.hospital &&
  appUser?.specialties &&
  appUser.specialties.length > 0 &&
  appUser?.doctor_identifier &&
  appUser?.age !== null &&
  appUser?.age !== undefined &&
  appUser?.gender &&
  appUser?.qualification &&
  appUser?.years_experience !== null &&
  appUser?.years_experience !== undefined,
);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [weight, setWeight] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [clinicalStage, setClinicalStage] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [phone, setPhone] = useState('');
  const [hospital, setHospital] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [doctorIdentifier, setDoctorIdentifier] = useState('');
  const [doctorAge, setDoctorAge] = useState<number | ''>('');
  const [doctorGender, setDoctorGender] = useState('');
  const [qualification, setQualification] = useState('');
  const [yearsExperience, setYearsExperience] = useState<number | ''>('');
  const [consent, setConsent] = useState(false);
  const [googleSignInRole, setGoogleSignInRole] = useState<UserRole>('patient');
  const [googleOnboarding, setGoogleOnboarding] = useState<GoogleOnboardingState | null>(null);
  const googleOnboardingRef = useRef<GoogleOnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const navigate = useNavigate();
  const { user } = useAuth();
  const isGoogleOnboarding = googleOnboarding !== null;
  const activeRole = isGoogleOnboarding ? googleOnboarding.role : role;
  const showSignupFields = !isLogin || isGoogleOnboarding;

  useEffect(() => {
    if (user && !isGoogleOnboarding && !googleOnboardingRef.current) {
      navigate(getDashboardRouteForRole(user.role));
    }
  }, [user, isGoogleOnboarding, navigate]);

  const startGoogleOnboarding = useEffectEvent(async (appUser: AppUser) => {
    const onboardingState = { email: appUser.email, role: appUser.role };
    googleOnboardingRef.current = onboardingState;
    setGoogleOnboarding(onboardingState);
    setIsLogin(false);
    setRole(appUser.role);
    setEmail(appUser.email);
    setPassword('');
    setMessage(null);
    setError(null);

    if (appUser.role === 'patient') {
      try {
        const profileResponse = await mongodb
          .from('patient_profiles')
          .eq('id', appUser.id)
          .single();
        const profile = (profileResponse?.data as Profile | null | undefined) ?? null;
        setFullName(profile?.full_name || appUser.full_name || '');
        setPhone(profile?.phone || appUser.phone || '');
        setGender(profile?.gender || appUser.gender || '');
        setDateOfBirth(profile?.date_of_birth || '');
        setWeight(profile?.weightKg ?? '');
        setHeight(profile?.heightCm ?? '');
        setClinicalStage(profile?.stage || '');
        setConsent(Boolean(profile?.consent_flags));
      } catch {
        setFullName(appUser.full_name || '');
        setPhone(appUser.phone || '');
        setGender(appUser.gender || '');
      }
      return;
    }

    setFullName(appUser.full_name || '');
    setPhone(appUser.phone || '');
    setHospital(appUser.hospital || '');
    setSpecialties((appUser.specialties || []).join(', '));
    setDoctorIdentifier(appUser.doctor_identifier || '');
    setDoctorAge(appUser.age ?? '');
    setDoctorGender(appUser.gender || '');
    setQualification(appUser.qualification || '');
    setYearsExperience(appUser.years_experience ?? '');
    setConsent(true);
  });

  const finalizeGoogleAuth = useEffectEvent(async (appUser: AppUser, accessToken: string) => {
    mongodb.setToken(accessToken);
    sessionStorage.removeItem(GOOGLE_SIGN_IN_ROLE_KEY);

    if (appUser.role === 'patient') {
      let profile: Profile | null = null;
      try {
        const profileResponse = await mongodb
          .from('patient_profiles')
          .eq('id', appUser.id)
          .single();
        profile = (profileResponse?.data as Profile | null | undefined) ?? null;
      } catch {
        profile = null;
      }
      if (!isPatientProfileComplete(profile)) {
        await startGoogleOnboarding(appUser);
        return;
      }
    } else {
      if (!isDoctorProfileComplete(appUser)) {
        await startGoogleOnboarding(appUser);
        return;
      }
    }

    if (appUser.role === 'doctor' && appUser.approval_status === 'pending') {
      mongodb.clearToken();
      googleOnboardingRef.current = null;
      setGoogleOnboarding(null);
      setMessage('Doctor account created successfully. You can sign in only after an admin approves your account.');
      setIsLogin(true);
      return;
    }

    googleOnboardingRef.current = null;
    setGoogleOnboarding(null);
    navigate(getDashboardRouteForRole(appUser.role));
  });

  const completeGoogleAuthentication = useEffectEvent(async (
    firebaseUser: FirebaseUser,
    selectedRole: UserRole,
  ) => {
    if (!firebaseUser.email) throw new Error('Google account did not provide an email address.');
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(`${apiUrl}/api/auth/google-signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken, email: firebaseUser.email, name: firebaseUser.displayName, role: selectedRole }),
    });
    let payload: any = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) throw new Error(payload?.error || 'Failed to authenticate with backend');
    if (!payload?.access_token || !payload?.user) throw new Error('Authentication failed - invalid response format');
    await finalizeGoogleAuth(payload.user as AppUser, payload.access_token);
  });

  const resetSignupFields = () => {
    setFullName(''); setGender(''); setDateOfBirth(''); setWeight(''); setHeight('');
    setClinicalStage(''); setPhone(''); setHospital(''); setSpecialties('');
    setDoctorIdentifier(''); setDoctorAge(''); setDoctorGender(''); setQualification('');
    setYearsExperience(''); setConsent(false);
    googleOnboardingRef.current = null; setGoogleOnboarding(null);
  };

  const handleGoogleOnboardingSubmit = async () => {
    if (!googleOnboarding) return;
    const token = mongodb.getToken();
    if (!token) throw new Error('Google session expired. Please sign in with Google again.');

    const payload = googleOnboarding.role === 'patient'
      ? {
          full_name: fullName, phone, gender, date_of_birth: dateOfBirth,
          weight: weight === '' ? null : Number(weight),
          height: height === '' ? null : Number(height),
          clinical_stage: clinicalStage || null,
          consent_flags: { medical_data_processing: consent, camera_microphone: consent },
        }
      : {
          full_name: fullName, phone, hospital,
          specialties: specialties.split(',').map((item) => item.trim()).filter(Boolean),
          doctor_identifier: doctorIdentifier,
          age: doctorAge === '' ? null : Number(doctorAge),
          gender: doctorGender, qualification,
          years_experience: yearsExperience === '' ? null : Number(yearsExperience),
        };

    const response = await fetch(`${apiUrl}/api/auth/complete-google-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    let result: any = null;
    try { result = await response.json(); } catch { result = null; }
    if (!response.ok) throw new Error(result?.error || 'Failed to save Google profile details');
    if (!result?.data?.user || !result?.data?.access_token) throw new Error('Profile saved, but the login response was incomplete.');

    mongodb.setToken(result.data.access_token);
    googleOnboardingRef.current = null;
    setGoogleOnboarding(null);

    if (result.data.user.role === 'doctor' && result.data.user.approval_status === 'pending') {
      mongodb.clearToken();
      setIsLogin(true);
      setMessage('Doctor account created successfully. You can sign in only after an admin approves your account.');
      resetSignupFields();
      return;
    }
    navigate(getDashboardRouteForRole(result.data.user.role));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      if (isGoogleOnboarding) {
        await handleGoogleOnboardingSubmit();
      } else if (isLogin) {
        const { data, error } = await mongodb.signIn(email, password);
        if (error) throw new Error(error);
        if (data?.access_token && data?.user) navigate(getDashboardRouteForRole(data.user.role));
        else throw new Error('Sign in failed');
      } else {
        const { data, error } = await mongodb.signUp(
          email, password, fullName,
          role === 'patient' ? gender : undefined,
          role === 'patient' ? dateOfBirth : undefined,
          role === 'patient' && weight !== '' ? Number(weight) : undefined,
          role === 'patient' && height !== '' ? Number(height) : undefined,
          role === 'patient' ? clinicalStage || undefined : undefined,
          role, phone || undefined,
          role === 'doctor' ? hospital || undefined : undefined,
          role === 'doctor' ? specialties.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
          role === 'doctor' ? doctorIdentifier || undefined : undefined,
          role === 'doctor' && doctorAge !== '' ? Number(doctorAge) : undefined,
          role === 'doctor' ? doctorGender || undefined : undefined,
          role === 'doctor' ? qualification || undefined : undefined,
          role === 'doctor' && yearsExperience !== '' ? Number(yearsExperience) : undefined,
        );
        if (error) throw new Error(error);
        if (data?.user?.role === 'doctor' && data.user.approval_status === 'pending') {
          setMessage('Doctor account created successfully. You can sign in only after an admin approves your account.');
          setIsLogin(true); setPassword(''); resetSignupFields(); mongodb.clearToken();
        } else if (data?.access_token && data?.user) {
          navigate(getDashboardRouteForRole(data.user.role));
        } else throw new Error('Sign up failed');
      }
    } catch (err: any) {
      const msg = err?.message ?? 'An unexpected error occurred.';
      if (msg.includes('Failed to fetch') || err instanceof TypeError) {
        setError(`Unable to reach API at ${apiUrl}. Check your connection and make sure the backend is running.`);
      } else if (msg.includes('already exists')) {
        setError('User with this email already exists. Please sign in instead.');
      } else if (msg.toLowerCase().includes('waiting for admin approval')) {
        setError('Doctor account is waiting for admin approval.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true); setError(null); setMessage(null);
    try {
      resetSignupFields();
      const result = await signInWithPopup(auth, googleProvider);
      if (!result?.user) { setError('Google sign-in was cancelled. Please try again.'); return; }
      await completeGoogleAuthentication(result.user, googleSignInRole);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed. Please try again.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google sign-in in Firebase yet.');
      } else if (err.code !== 'auth/cancelled-popup-request') {
        setError(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Botanical design tokens ── */
  const C = {
    bg:         '#F9F8F4',
    fg:         '#2D3A31',
    primary:    '#8C9A84',
    clay:       '#DCCFC2',
    border:     '#E6E2DA',
    terracotta: '#C27B66',
    muted:      '#6E7D6C',
  } as const;

  const inputCls = `w-full pl-10 pr-4 py-3 rounded-2xl border text-sm transition-all duration-300 focus:outline-none focus:ring-2`;
  const inputStyle = { borderColor: C.border, background: C.bg, color: C.fg, fontFamily: "'Source Sans 3', sans-serif" };
  const labelStyle = {
    fontFamily: "'Source Sans 3', sans-serif", color: C.muted,
    fontSize: '0.75rem', letterSpacing: '0.06em',
    textTransform: 'uppercase' as const, fontWeight: 600,
  };

  return (
    <div className="min-h-screen flex" style={{ background: C.bg, fontFamily: "'Source Sans 3', sans-serif" }}>
      {/* Paper grain texture */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.018]"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* ── Left botanical panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12 relative overflow-hidden" style={{ background: C.fg }}>
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: C.primary }} />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: C.terracotta }} />

        <div className="relative z-10">
          <button type="button" onClick={() => navigate('/admin-login')} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${C.primary}30` }}>
              <BrainCircuit className="h-5 w-5" style={{ color: C.primary }} strokeWidth={1.5} />
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", color: '#F9F8F4', fontSize: '1.25rem', fontWeight: 600 }}>NeuroCare</span>
          </button>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1 py-16">
          <div
            className="w-52 h-64 flex flex-col items-center justify-end pb-8 px-6 text-center mb-8"
            style={{ background: `${C.primary}18`, border: `1px solid ${C.primary}30`, borderRadius: '9999px 9999px 32px 32px' }}
          >
            <div style={{ color: '#F9F8F4', opacity: 0.4 }} className="mb-4">
              <BrainCircuit className="h-12 w-12 mx-auto" strokeWidth={1} />
            </div>
            <p style={{ fontFamily: "'Playfair Display', serif", color: '#F9F8F4', fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.2 }}>
              AI-Powered<br /><em style={{ color: C.primary, fontStyle: 'italic' }}>Screening</em>
            </p>
          </div>
          <div className="space-y-3 text-left w-full max-w-xs">
            {[
              'Voice, spiral, wave & motor tests',
              'Fusion Report emailed instantly',
              'Secure Firebase authentication',
              'Free — no subscription needed',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${C.primary}25` }}>
                  <CheckCircle className="h-3 w-3" style={{ color: C.primary }} strokeWidth={2.5} />
                </div>
                <span style={{ color: C.clay, fontSize: '0.875rem', fontFamily: "'Source Sans 3', sans-serif" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: `${C.clay}80`, fontSize: '0.7rem', fontFamily: "'Source Sans 3', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' }} className="relative z-10">
          Not a substitute for clinical diagnosis
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <button type="button" onClick={() => navigate('/admin-login')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.fg }}>
              <BrainCircuit className="h-4 w-4 text-white" strokeWidth={1.5} />
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", color: C.fg, fontSize: '1.1rem', fontWeight: 600 }}>NeuroCare</span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' as const }}
          className="w-full max-w-md mx-auto"
        >
          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full border mb-5"
              style={{ borderColor: C.primary, color: C.primary }}>
              <Sparkles className="h-3 w-3" strokeWidth={1.5} />
              AI-Powered Care
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: C.fg, fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 }} className="mb-2">
              {isGoogleOnboarding
                ? 'Complete Your Profile'
                : isLogin
                  ? <><span>Welcome </span><em style={{ fontStyle: 'italic', color: C.primary }}>Back</em></>
                  : <><span>Create </span><em style={{ fontStyle: 'italic', color: C.primary }}>Account</em></>}
            </h1>
            <p style={{ color: C.muted, fontSize: '0.9rem' }}>
              {isGoogleOnboarding
                ? 'One last step — share your details to finish Google sign-up.'
                : isLogin
                  ? 'Sign in to continue your health journey.'
                  : 'Join NeuroCare to take control of your health.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isGoogleOnboarding && (
              <>
                {/* Role selector */}
                <div>
                  <p style={labelStyle} className="mb-2">Sign in as</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['patient', 'doctor'] as const).map((val) => (
                      <button key={val} type="button" onClick={() => setGoogleSignInRole(val)}
                        className="rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-300"
                        style={{
                          borderColor: googleSignInRole === val ? C.fg : C.border,
                          background: googleSignInRole === val ? C.fg : 'transparent',
                          color: googleSignInRole === val ? '#F9F8F4' : C.muted,
                          fontFamily: "'Source Sans 3', sans-serif", textTransform: 'capitalize',
                        }}>
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Google sign-in button */}
                <button type="button" onClick={handleGoogleSignIn} disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 hover:opacity-80 disabled:opacity-50 text-sm font-medium"
                  style={{ borderColor: C.border, color: C.fg, background: '#fff', fontFamily: "'Source Sans 3', sans-serif" }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 border-t" style={{ borderColor: C.border }} />
                  <span className="text-xs uppercase tracking-widest" style={{ color: C.muted, fontFamily: "'Source Sans 3', sans-serif" }}>or email</span>
                  <div className="flex-1 border-t" style={{ borderColor: C.border }} />
                </div>
              </>
            )}

            {showSignupFields && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                {!isGoogleOnboarding && (
                  <>
                    <p style={labelStyle} className="mb-2">Account Type</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(['patient', 'doctor'] as const).map((val) => (
                        <button key={val} type="button" onClick={() => setRole(val)}
                          className="rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-300"
                          style={{
                            borderColor: activeRole === val ? C.fg : C.border,
                            background: activeRole === val ? C.fg : 'transparent',
                            color: activeRole === val ? '#F9F8F4' : C.muted,
                            fontFamily: "'Source Sans 3', sans-serif", textTransform: 'capitalize',
                          }}>
                          {val}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {isGoogleOnboarding && (
                  <div className="rounded-2xl border px-4 py-3 text-sm"
                    style={{ borderColor: C.primary, background: `${C.primary}10`, color: C.fg, fontFamily: "'Source Sans 3', sans-serif" }}>
                    Completing Google sign-up as <span className="font-semibold capitalize">{activeRole}</span>.
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label style={labelStyle} className="block mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                    <input type="text" placeholder="Enter your full name" required value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label style={labelStyle} className="block mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                    <input type="tel" placeholder="Enter contact number" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>

                {activeRole === 'patient' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={labelStyle} className="block mb-1.5">Gender</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                          <select required value={gender} onChange={e => setGender(e.target.value)} className={`${inputCls} appearance-none`} style={inputStyle}>
                            <option value="" disabled>Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle} className="block mb-1.5">Date of Birth</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                          <input type="date" required value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className={inputCls} style={inputStyle} />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={labelStyle} className="block mb-1.5">Weight (kg)</label>
                        <div className="relative">
                          <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                          <input type="number" placeholder="e.g. 70" min="1" max="300" step="0.1" value={weight} onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} style={inputStyle} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle} className="block mb-1.5">Height (cm)</label>
                        <div className="relative">
                          <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                          <input type="number" placeholder="e.g. 175" min="1" max="300" step="0.1" value={height} onChange={e => setHeight(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} style={inputStyle} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle} className="block mb-1.5">Clinical Stage (Optional)</label>
                      <div className="relative">
                        <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                        <select value={clinicalStage} onChange={e => setClinicalStage(e.target.value)} className={`${inputCls} appearance-none`} style={inputStyle}>
                          <option value="" disabled>Select Clinical Stage</option>
                          <option value="Not Diagnosed">Not Diagnosed</option>
                          <option value="Stage 1">Stage 1</option>
                          <option value="Stage 2">Stage 2</option>
                          <option value="Stage 3">Stage 3</option>
                          <option value="Stage 4">Stage 4</option>
                          <option value="Stage 5">Stage 5</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={labelStyle} className="block mb-1.5">Doctor ID / Reg. No.</label>
                        <div className="relative">
                          <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                          <input type="text" placeholder="Enter doctor ID" value={doctorIdentifier} onChange={e => setDoctorIdentifier(e.target.value)} className={inputCls} style={inputStyle} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle} className="block mb-1.5">Age</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                          <input type="number" placeholder="e.g. 42" min="21" max="100" value={doctorAge} onChange={e => setDoctorAge(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} style={inputStyle} />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={labelStyle} className="block mb-1.5">Gender</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                          <select value={doctorGender} onChange={e => setDoctorGender(e.target.value)} className={`${inputCls} appearance-none`} style={inputStyle}>
                            <option value="" disabled>Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle} className="block mb-1.5">Yrs Experience</label>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                          <input type="number" placeholder="e.g. 12" min="0" max="60" value={yearsExperience} onChange={e => setYearsExperience(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} style={inputStyle} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle} className="block mb-1.5">Hospital / Clinic</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                        <input type="text" placeholder="Enter hospital or clinic" value={hospital} onChange={e => setHospital(e.target.value)} className={inputCls} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle} className="block mb-1.5">Qualification</label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                        <input type="text" placeholder="MBBS, MD Neurology" value={qualification} onChange={e => setQualification(e.target.value)} className={inputCls} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle} className="block mb-1.5">Specialties</label>
                      <div className="relative">
                        <BriefcaseMedical className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                        <input type="text" placeholder="Movement Disorders, Tele-neurology" value={specialties} onChange={e => setSpecialties(e.target.value)} className={inputCls} style={inputStyle} />
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: C.muted }}>Separate with commas. Doctor accounts pending until admin approval.</p>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {!isGoogleOnboarding && (
              <>
                <div>
                  <label style={labelStyle} className="block mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                    <input type="email" placeholder="Enter your email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle} className="block mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                    <input type="password" placeholder="Enter your password" required value={password} onChange={e => setPassword(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>
              </>
            )}

            {isGoogleOnboarding && (
              <div>
                <label style={labelStyle} className="block mb-1.5">Google Account</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.muted }} strokeWidth={1.5} />
                  <input type="email" value={googleOnboarding?.email || email} readOnly className={inputCls}
                    style={{ ...inputStyle, background: C.clay, opacity: 0.7, cursor: 'not-allowed' }} />
                </div>
              </div>
            )}

            {showSignupFields && activeRole === 'patient' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-3 p-4 rounded-2xl border"
                style={{ borderColor: C.primary, background: `${C.primary}08` }}>
                <input type="checkbox" id="consent" required checked={consent} onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded" style={{ accentColor: C.fg }} />
                <label htmlFor="consent" className="text-sm leading-relaxed" style={{ color: C.fg, fontFamily: "'Source Sans 3', sans-serif" }}>
                  I consent to the use of my camera/microphone and processing of my medical data, as described in the{' '}
                  <a href="#" className="underline" style={{ color: C.primary }}>Privacy Policy</a>.
                </label>
              </motion.div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-2xl border text-sm"
                style={{ borderColor: `${C.terracotta}40`, background: `${C.terracotta}10`, color: C.terracotta, fontFamily: "'Source Sans 3', sans-serif" }}>
                <AlertCircle size={16} className="flex-shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
            {message && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-2xl border text-sm"
                style={{ borderColor: `${C.primary}40`, background: `${C.primary}10`, color: C.fg, fontFamily: "'Source Sans 3', sans-serif" }}>
                <CheckCircle size={16} className="flex-shrink-0" />
                <p>{message}</p>
              </motion.div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-full py-4 font-semibold uppercase tracking-widest text-sm transition-all duration-300 hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: C.fg, color: '#F9F8F4', fontFamily: "'Source Sans 3', sans-serif", boxShadow: `0 8px 25px -6px rgba(45,58,49,0.25)` }}>
              {loading
                ? <LoaderCircle className="animate-spin h-4 w-4" />
                : <span>{isGoogleOnboarding ? 'Complete Google Sign Up' : isLogin ? 'Sign In' : 'Create Account'}</span>}
            </button>
          </form>

          {!isGoogleOnboarding && (
            <div className="mt-6 text-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 border-t" style={{ borderColor: C.border }} />
                <span className="text-xs uppercase tracking-widest" style={{ color: C.muted, fontFamily: "'Source Sans 3', sans-serif" }}>
                  {isLogin ? "Don't have an account?" : 'Have an account?'}
                </span>
                <div className="flex-1 border-t" style={{ borderColor: C.border }} />
              </div>
              <button
                onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); setRole('patient'); googleOnboardingRef.current = null; setGoogleOnboarding(null); }}
                className="text-sm font-semibold uppercase tracking-widest transition-all duration-300 hover:opacity-70 rounded-full px-6 py-2 border"
                style={{ borderColor: C.primary, color: C.primary, fontFamily: "'Source Sans 3', sans-serif" }}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
          )}

          <p className="text-center text-xs mt-6 leading-relaxed" style={{ color: C.muted, fontFamily: "'Source Sans 3', sans-serif" }}>
            By continuing you agree to our{' '}
            <a href="#" className="underline hover:opacity-70 transition-opacity" style={{ color: C.primary }}>Terms</a>
            {' '}and{' '}
            <a href="#" className="underline hover:opacity-70 transition-opacity" style={{ color: C.primary }}>Privacy Policy</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
