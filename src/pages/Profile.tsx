import { useState, useEffect } from 'react';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { LoaderCircle, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setDob(profile.date_of_birth || '');
      setGender(profile.gender || '');
      setPhone(profile.phone || '');
      setEmergencyContact(profile.emergency_contact || '');
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from('patient_profiles')
      .update({
        full_name: fullName,
        date_of_birth: dob,
        gender: gender,
        phone: phone,
        emergency_contact: emergencyContact,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Profile updated successfully!');
      await refreshProfile(); // Refresh the profile in the auth context
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">My Profile</h2>
      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
            <input id="email" type="email" value={user?.email || ''} disabled className="w-full bg-input p-3 rounded-lg border border-border opacity-70 cursor-not-allowed" />
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
            <input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-input p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-muted-foreground mb-1">Date of Birth</label>
            <input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-input p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-muted-foreground mb-1">Gender</label>
            <input id="gender" type="text" value={gender} onChange={e => setGender(e.target.value)} placeholder="e.g., Male, Female, Non-binary" className="w-full bg-input p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-1">Phone Number</label>
            <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-input p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          <div>
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-muted-foreground mb-1">Emergency Contact</label>
            <input id="emergencyContact" type="tel" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="w-full bg-input p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          
          {error && (
            <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 p-3 rounded-lg">
              <AlertCircle size={20} />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center space-x-2 text-green-400 bg-green-900/20 p-3 rounded-lg">
              <p className="text-sm">{success}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-semibold p-3 rounded-lg hover:bg-opacity-90 transition-colors flex items-center justify-center disabled:opacity-50">
            {loading ? <LoaderCircle className="animate-spin" /> : 'Save Changes'}
          </button>
        </form>
      </Card>
    </div>
  );
};

export default Profile;
