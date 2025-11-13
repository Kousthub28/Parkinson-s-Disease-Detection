import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, AlertCircle, LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              consent_medical_data: consent,
              consent_camera_mic: consent,
            }
          }
        });
        if (error) throw error;
        if (data.user?.identities?.length === 0) {
           setError("User with this email already exists.");
        } else if (data.user) {
            setMessage('Signup successful! Please check your email for a confirmation link to log in.');
        }
      }
    } catch (error: any) {
      const message = error?.message ?? 'An unexpected error occurred.';
      console.error('Authentication request failed', { error, supabaseUrl });

      if (message.includes('Mock client: Supabase not configured')) {
        setError('Supabase environment variables are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file and restart the dev server.');
      } else if (message.includes('Failed to fetch') || error instanceof TypeError) {
        const target = supabaseUrl || 'your Supabase project URL';
        setError(`Unable to reach Supabase at ${target}. Check your internet connection, VPN/proxy, and make sure the URL is correct.`);
      } else if (message.includes('NAME_NOT_RESOLVED')) {
        const target = supabaseUrl || 'your Supabase project URL';
        setError(`DNS lookup failed for ${target}. Confirm VITE_SUPABASE_URL matches your project (https://<ref>.supabase.co) and that DNS isn't blocked on your network.`);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-lg border border-border">
        <div className="text-center mb-8">
          <BrainCircuit className="mx-auto h-12 w-12 text-primary-foreground" />
          <h1 className="text-3xl font-bold mt-4">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-muted-foreground">
            {isLogin ? 'Sign in to continue to NeuroCare' : 'Join us to take control of your health'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
             <input type="text" placeholder="Full Name" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-input p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none" />
          )}
          <input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-input p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none" />
          <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-input p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none" />
          
          {!isLogin && (
            <div className="flex items-start space-x-2">
                <input type="checkbox" id="consent" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                <label htmlFor="consent" className="text-sm text-muted-foreground">
                    I consent to the use of my camera/mic and the processing of my medical data for analysis, as described in the <a href="#" className="underline text-primary-foreground">Privacy Policy</a>.
                </label>
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 p-3 rounded-lg">
              <AlertCircle size={20} />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {message && (
            <div className="flex items-center space-x-2 text-green-400 bg-green-900/20 p-3 rounded-lg">
              <p className="text-sm">{message}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-semibold p-3 rounded-lg hover:bg-opacity-90 transition-colors flex items-center justify-center disabled:opacity-50">
            {loading ? <LoaderCircle className="animate-spin" /> : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <div className="text-center mt-6">
          <button onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }} className="text-sm text-muted-foreground hover:text-foreground">
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
