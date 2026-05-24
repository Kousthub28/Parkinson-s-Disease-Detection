import { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { LoaderCircle, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const TOKEN_KEY = 'mongodb_token';

const getToken = () => sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);

const Profile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [weight, setWeight] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setDob(profile.date_of_birth || '');
      setGender(profile.gender || '');
      setPhone(profile.phone || '');
      setEmergencyContact(profile.emergency_contact || '');
      setWeight(profile.weightKg ?? '');
      setHeight(profile.heightCm ?? '');
    }
  }, [profile]);

  const bmiInfo = useMemo(() => {
    if (weight === '' || height === '' || !weight || !height) return null;
    const w = Number(weight);
    const h = Number(height) / 100;
    if (h <= 0 || w <= 0) return null;
    const bmi = w / (h * h);
    let bmiClass = '';
    if (bmi < 18.5) bmiClass = 'Underweight';
    else if (bmi < 25) bmiClass = 'Normal Weight';
    else if (bmi < 30) bmiClass = 'Overweight';
    else bmiClass = 'Obese';
    return { bmi: Math.round(bmi * 10) / 10, bmiClass };
  }, [weight, height]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const w = weight === '' ? null : Number(weight);
      const h = height === '' ? null : Number(height);

      const profileUpdates: Record<string, any> = {
        full_name: fullName,
        date_of_birth: dob,
        gender: gender,
        phone: phone,
        emergency_contact: emergencyContact,
        weightKg: w,
        heightCm: h,
        bmi: bmiInfo?.bmi ?? null,
        bmiClass: bmiInfo?.bmiClass ?? null,
        updated_at: new Date().toISOString(),
      };

      // Calculate age from DOB
      if (dob) {
        try {
          const dobDate = new Date(dob);
          const today = new Date();
          let age = today.getFullYear() - dobDate.getFullYear();
          const monthDiff = today.getMonth() - dobDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
            age--;
          }
          profileUpdates.age = age;
        } catch {
          // ignore age calc errors
        }
      }

      console.log('[Profile] Updating patient profile', { userId: user.id, updates: profileUpdates });

      const token = getToken();
      const response = await axios.patch(
        `${API_BASE_URL}/api/db/patient_profiles`,
        {
          filter: { id: user.id },
          updates: profileUpdates,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          timeout: 5000,
        },
      );

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      console.log('[Profile] ✅ Profile updated successfully in MongoDB');

      // Also update user record full_name, phone, gender
      try {
        await axios.patch(
          `${API_BASE_URL}/api/db/users`,
          {
            filter: { _id: user.id },
            updates: {
              full_name: fullName,
              phone: phone,
              gender: gender,
              updated_at: new Date().toISOString(),
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            timeout: 5000,
          },
        );
        console.log('[Profile] ✅ User record updated');
      } catch (userUpdateErr) {
        console.warn('[Profile] ⚠️ User record update failed (non-critical)', userUpdateErr);
      }

      // Update localStorage cache
      const cached = { ...profile, ...profileUpdates, id: user.id, patient_id: user.id };
      localStorage.setItem('user_profile', JSON.stringify(cached));

      setSuccess('Profile updated successfully!');
      await refreshProfile();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('[Profile] ❌ Profile update error:', error);
      const msg = error?.response?.data?.error || error?.message || 'Failed to update profile. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-gray-900">My Profile</h2>
      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="email" type="email" value={user?.email || ''} disabled className="w-full bg-gray-100 text-gray-700 p-3 rounded-lg border border-gray-300 opacity-70 cursor-not-allowed" />
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-white text-gray-900 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-white text-gray-900 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select id="gender" value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-white text-gray-900 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none appearance-none">
              <option value="" disabled>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white text-gray-900 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
            <input id="emergencyContact" type="tel" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="w-full bg-white text-gray-900 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input id="weight" type="number" step="0.1" min="1" max="300" placeholder="e.g. 70" value={weight} onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white text-gray-900 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
              <input id="height" type="number" step="0.1" min="1" max="300" placeholder="e.g. 175" value={height} onChange={e => setHeight(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white text-gray-900 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          {bmiInfo && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-800">
                BMI: <span className="font-bold">{bmiInfo.bmi}</span>{' '}
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ml-2 ${
                  bmiInfo.bmiClass === 'Normal Weight' ? 'bg-green-100 text-green-700' :
                  bmiInfo.bmiClass === 'Underweight' ? 'bg-yellow-100 text-yellow-700' :
                  bmiInfo.bmiClass === 'Overweight' ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>{bmiInfo.bmiClass}</span>
              </p>
            </div>
          )}
          
          {error && (
            <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
              <AlertCircle size={20} />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center space-x-2 text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
              <CheckCircle size={20} />
              <p className="text-sm">{success}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-semibold p-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 shadow-md hover:shadow-lg">
            {loading ? <LoaderCircle className="animate-spin" /> : 'Save Changes'}
          </button>
        </form>
      </Card>
    </div>
  );
};

export default Profile;
