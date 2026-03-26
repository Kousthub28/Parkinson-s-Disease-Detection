import { useEffect, useState } from 'react';
import Card from '../components/Card';
import { FileText, Download, LoaderCircle, FileDown } from 'lucide-react';
import { mongodb } from '../lib/mongodbClient';
import { TEST_QUERY_TIMEOUT_MS } from '../services/testPersistence';
import { useAuth } from '../hooks/useAuth';
import { Test } from '../types/database';
import { downloadTestReport, downloadTestHistoryCSV } from '../utils/reportUtils';

const getRiskColor = (result: any) => {
    const risk = result?.riskLevel || 'Pending';
    if (risk === 'Low') return 'text-primary bg-primary/10';
    if (risk === 'Medium') return 'text-secondary bg-secondary/10';
    if (risk === 'High') return 'text-destructive bg-destructive/10';
    return 'text-muted-foreground bg-muted/50';
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
        // Try MongoDB with short timeout
        const queryPromise = mongodb
          .from('tests')
          .select('*')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), TEST_QUERY_TIMEOUT_MS),
        );

        let mongodbTests: any[] = [];
        
        try {
          const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
          if (!error && data) {
            mongodbTests = data;
            console.log('✅ History: Loaded tests from MongoDB:', mongodbTests.length);
          }
        } catch (dbError) {
          console.warn('⚠️ History: MongoDB not available, loading from localStorage');
        }

        const localTests = [
          ...JSON.parse(localStorage.getItem('local_tests') || '[]'),
          ...JSON.parse(localStorage.getItem('local_test_results') || '[]'),
        ].filter((t: any) => t.patient_id === user.id);
        console.log('✅ History: Loaded tests from localStorage:', localTests.length);

        // Merge and deduplicate
        const allTests = [...localTests, ...mongodbTests];
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
            await downloadTestReport(test, user?.full_name);
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

        const channel = mongodb.channel('realtime-tests')
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
            mongodb.removeChannel(channel);
        };
    }, [user]);

  return (
    <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
            <h2 className="text-4xl font-serif font-bold text-foreground">Test History & Reports</h2>
            {tests.length > 0 && (
                <button
                    onClick={handleDownloadAll}
                    disabled={downloading === 'all'}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-soft hover:-translate-y-0.5"
                >
                    {downloading === 'all' ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                        <FileDown className="h-5 w-5" />
                    )}
                    <span>Download All as CSV</span>
                </button>
            )}
        </div>
        <Card className="rounded-organic-2 bg-white/60 border border-border/50 p-6 shadow-sm">
            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <LoaderCircle className="animate-spin h-10 w-10 text-primary" />
                    </div>
                ) : tests.length > 0 ? (
                    tests.map(item => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-background/50 rounded-2xl border border-border/40 hover:bg-white/80 hover:shadow-float transition-all duration-300 group">
                            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                                    <FileText className="h-7 w-7 text-primary" />
                                </div>
                                <div>
                                    <p className="font-serif font-bold text-lg capitalize text-foreground">{item.test_type} Analysis</p>
                                    <p className="text-sm font-medium text-muted-foreground mt-0.5">{new Date(item.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/30">
                                <span className={`font-bold px-4 py-1.5 rounded-full text-sm uppercase tracking-wide ${getRiskColor(item.result)}`}>
                                    {(item.result as any)?.riskLevel || 'Pending Analysis'}
                                </span>
                                <button 
                                    onClick={() => handleDownload(item)}
                                    disabled={!item.result || downloading === item.id}
                                    className="flex items-center gap-2 text-sm font-bold text-secondary hover:text-secondary-foreground hover:bg-secondary px-4 py-2 rounded-full border border-secondary/20 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {downloading === item.id ? (
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download size={16} />
                                    )}
                                    <span className="hidden sm:inline">Report</span>
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16">
                        <div className="bg-muted/50 w-20 h-20 mx-auto rounded-[2rem] flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-serif text-2xl font-bold text-foreground">No History Yet</h3>
                        <p className="text-muted-foreground mt-2 font-medium">You haven't performed any tests or uploaded any data.</p>
                    </div>
                )}
            </div>
        </Card>
    </div>
  );
};

export default History;
