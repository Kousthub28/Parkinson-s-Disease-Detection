import { useEffect, useState } from 'react';
import Card from '../components/Card';
import { FileText, Download, LoaderCircle, FileDown } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Test } from '../types/database';
import { downloadTestReport, downloadTestHistoryCSV } from '../utils/reportUtils';

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
    const [downloading, setDownloading] = useState<string | null>(null);

    const fetchTests = async () => {
      if (!user) {
          setLoading(false);
          return;
      }
      
      try {
        // Try Supabase with short timeout
        const queryPromise = supabase
          .from('tests')
          .select('*')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 3000)
        );

        let supabaseTests: any[] = [];
        
        try {
          const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
          if (!error && data) {
            supabaseTests = data;
            console.log('✅ History: Loaded tests from Supabase:', supabaseTests.length);
          }
        } catch (dbError) {
          console.warn('⚠️ History: Supabase not available, loading from localStorage');
        }

        // Load local tests
        const localTests = JSON.parse(localStorage.getItem('local_tests') || '[]')
          .filter((t: any) => t.patient_id === user.id);
        console.log('✅ History: Loaded tests from localStorage:', localTests.length);

        // Merge and deduplicate
        const allTests = [...localTests, ...supabaseTests];
        const uniqueTests = Array.from(new Map(allTests.map(t => [t.id, t])).values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setTests(uniqueTests);
        console.log('📊 History: Total tests displayed:', uniqueTests.length);
      } catch (error) {
        console.error('Error fetching tests:', error);
        setTests([]);
      }
      
      setLoading(false);
    };

    const handleDownload = async (test: Test) => {
        try {
            setDownloading(test.id);
            await downloadTestReport(test);
        } catch (error) {
            console.error('Error downloading report:', error);
            alert('Failed to download report. Please try again.');
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadAll = async () => {
        if (tests.length === 0) return;
        try {
            setDownloading('all');
            await downloadTestHistoryCSV(tests);
        } catch (error) {
            console.error('Error downloading history:', error);
            alert('Failed to download history. Please try again.');
        } finally {
            setDownloading(null);
        }
    };

    useEffect(() => {
        if (!user) {
            setLoading(false);
            setTests([]);
            return;
        }

        setLoading(true);
        fetchTests();

        const channel = supabase.channel('realtime-tests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tests',
                filter: `patient_id=eq.${user.id}`
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
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">Test History & Reports</h2>
            {tests.length > 0 && (
                <button
                    onClick={handleDownloadAll}
                    disabled={downloading === 'all'}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
                >
                    {downloading === 'all' ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                        <FileDown className="h-4 w-4" />
                    )}
                    <span>Download All as CSV</span>
                </button>
            )}
        </div>
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
                                <button 
                                    onClick={() => handleDownload(item)}
                                    disabled={!item.result || downloading === item.id}
                                    className="flex items-center space-x-2 text-muted-foreground hover:text-foreground disabled:opacity-50 transition"
                                >
                                    {downloading === item.id ? (
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download size={18} />
                                    )}
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
