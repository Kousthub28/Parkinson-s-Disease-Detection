import { useEffect, useState } from 'react';
import Card from '../components/Card';
import { FileText, Download, LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Test } from '../types/database';

const getRiskColor = (result: any) => {
    const risk = result?.riskLevel || 'Pending';
    if (risk === 'Low') return 'text-green-400';
    if (risk === 'Medium') return 'text-yellow-400';
    if (risk === 'High') return 'text-red-400';
    return 'text-muted-foreground';
}

const History = () => {
    const { user } = useAuth();
    const [tests, setTests] = useState<Test[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTests = async () => {
      if (!user) return;
      const { data, error } = await supabase
          .from('tests')
          .select('*')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });

      if (error) {
          console.error('Error fetching tests:', error);
      } else {
          setTests(data);
      }
      setLoading(false);
    };

    useEffect(() => {
        setLoading(true);
        fetchTests();

        const channel = supabase.channel('realtime-tests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tests',
                filter: `patient_id=eq.${user?.id}`
            },
            (payload) => {
                console.log('Realtime change received!', payload);
                // Refetch all tests to update the UI
                fetchTests();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

  return (
    <div>
        <h2 className="text-3xl font-bold mb-6">Test History & Reports</h2>
        <Card>
            <div className="divide-y divide-border">
                {loading ? (
                    <div className="flex justify-center items-center p-8">
                        <LoaderCircle className="animate-spin h-8 w-8 text-primary" />
                    </div>
                ) : tests.length > 0 ? (
                    tests.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-4">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="font-semibold capitalize">{item.test_type} Analysis</p>
                                    <p className="text-sm text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-6">
                                <span className={`font-bold ${getRiskColor(item.result)}`}>
                                    {(item.result as any)?.riskLevel || 'Pending Analysis'}
                                </span>
                                <button className="flex items-center space-x-2 text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={!item.result}>
                                    <Download size={18} />
                                    <span>Report</span>
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground p-8">You haven't performed any tests yet.</p>
                )}
            </div>
        </Card>
    </div>
  );
};

export default History;
