import { useEffect, useState } from 'react';
import Card from '../components/Card';
import { FileText, Download, LoaderCircle, FileDown, Image as ImageIcon, Volume2, Video } from 'lucide-react';
import { mongodb } from '../lib/mongodbClient';
import { TEST_QUERY_TIMEOUT_MS } from '../services/testPersistence';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { Test } from '../types/database';
import { downloadTestReport, downloadTestHistoryCSV } from '../utils/reportUtils';
import { getLocale, translateModality, translateRiskLevel } from '../utils/localization';
import { fetchStoredArtifactObjectUrl, getArtifactKindForTest, isStoredArtifactPath } from '../utils/testArtifacts';

const getRiskColor = (result: any) => {
    const risk = result?.riskLevel || 'Pending';
    if (risk === 'Low') return 'text-primary bg-primary/10';
    if (risk === 'Medium') return 'text-secondary bg-secondary/10';
    if (risk === 'High') return 'text-destructive bg-destructive/10';
    return 'text-muted-foreground bg-muted/50';
}

const TestArtifactPreview = ({ item }: { item: Test }) => {
    const result = (item.result || {}) as Record<string, any>;
    const artifactKind = getArtifactKindForTest(item.test_type, result.artifactMimeType);
    const directUrl = typeof result.artifactDataUrl === 'string'
        ? result.artifactDataUrl
        : typeof item.raw_storage_path === 'string' && (item.raw_storage_path.startsWith('data:') || item.raw_storage_path.startsWith('blob:'))
            ? item.raw_storage_path
            : null;
    const [artifactUrl, setArtifactUrl] = useState<string | null>(directUrl);
    const [loadingArtifact, setLoadingArtifact] = useState(false);

    useEffect(() => {
        let objectUrl: string | null = null;
        let cancelled = false;

        if (!artifactKind) {
            setArtifactUrl(null);
            return undefined;
        }

        if (directUrl) {
            setArtifactUrl(directUrl);
            setLoadingArtifact(false);
            return undefined;
        }

        if (!isStoredArtifactPath(item.raw_storage_path)) {
            setArtifactUrl(null);
            setLoadingArtifact(false);
            return undefined;
        }

        setLoadingArtifact(true);
        fetchStoredArtifactObjectUrl(item.raw_storage_path)
            .then((url) => {
                objectUrl = url;
                if (!cancelled) setArtifactUrl(url);
            })
            .catch(() => {
                if (!cancelled) setArtifactUrl(null);
            })
            .finally(() => {
                if (!cancelled) setLoadingArtifact(false);
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [artifactKind, directUrl, item.raw_storage_path]);

    if (!artifactKind) return null;

    if (loadingArtifact) {
        return (
            <div className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Loading saved sample...
            </div>
        );
    }

    if (!artifactUrl) return null;

    if (artifactKind === 'image') {
        return (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/40 bg-background/60 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ImageIcon className="h-4 w-4" />
                </div>
                <img
                    src={artifactUrl}
                    alt={`${item.test_type} uploaded drawing`}
                    className="h-24 w-32 rounded-xl border border-border/40 bg-white object-contain"
                />
            </div>
        );
    }

    if (artifactKind === 'video') {
        const isEyeMovement = result.source === 'guided-eye-movement-live' || result.protocol === 'guided-eye-follow-v1';
        return (
            <div className="mt-3 rounded-2xl border border-border/40 bg-background/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Video className="h-4 w-4 text-primary" />
                    {isEyeMovement ? 'Eye movement sample' : 'Voice video sample'}
                </div>
                <video src={artifactUrl} controls className="max-h-44 w-full max-w-sm rounded-xl bg-black" />
            </div>
        );
    }

    return (
        <div className="mt-3 rounded-2xl border border-border/40 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Volume2 className="h-4 w-4 text-primary" />
                Voice sample
            </div>
            <audio src={artifactUrl} controls className="w-full max-w-sm" />
        </div>
    );
};

const historyCopy = {
    en: {
        title: 'Test History & Reports',
        downloadAll: 'Download All as CSV',
        analysis: 'Analysis',
        pendingAnalysis: 'Pending Analysis',
        report: 'Report',
        noHistoryTitle: 'No History Yet',
        noHistoryBody: 'You have not performed any tests or uploaded any data.',
        reportDownloadError: 'Failed to download report. Please try again.',
        historyDownloadError: 'Failed to download history. Please try again.',
    },
    kn: {
        title: 'ಪರೀಕ್ಷಾ ಇತಿಹಾಸ ಮತ್ತು ವರದಿಗಳು',
        downloadAll: 'ಎಲ್ಲವನ್ನು CSV ಆಗಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
        analysis: 'ವಿಶ್ಲೇಷಣೆ',
        pendingAnalysis: 'ವಿಶ್ಲೇಷಣೆ ಬಾಕಿ',
        report: 'ವರದಿ',
        noHistoryTitle: 'ಇನ್ನೂ ಇತಿಹಾಸ ಇಲ್ಲ',
        noHistoryBody: 'ನೀವು ಇನ್ನೂ ಯಾವುದೇ ಪರೀಕ್ಷೆ ನಡೆಸಿಲ್ಲ ಅಥವಾ ಯಾವುದೇ ಡೇಟಾ ಅಪ್‌ಲೋಡ್ ಮಾಡಿಲ್ಲ.',
        reportDownloadError: 'ವರದಿಯನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
        historyDownloadError: 'ಇತಿಹಾಸವನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    },
} as const;

const History = () => {
    const { user } = useAuth();
    const { language } = useLanguage();
    const copy = historyCopy[language];
    const locale = getLocale(language);
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

        // Merge and deduplicate, while preserving local-only preview artifacts.
        const allTests = [...localTests, ...mongodbTests];
        const mergedById = new Map<string, any>();
        allTests.forEach((test: any) => {
          const existing = mergedById.get(test.id);
          if (!existing) {
            mergedById.set(test.id, test);
            return;
          }

          const existingResult = existing.result || {};
          const nextResult = test.result || {};
          mergedById.set(test.id, {
            ...existing,
            ...test,
            raw_storage_path: test.raw_storage_path || existing.raw_storage_path,
            result: {
              ...existingResult,
              ...nextResult,
              artifactDataUrl: nextResult.artifactDataUrl || existingResult.artifactDataUrl,
            },
          });
        });
        const uniqueTests = Array.from(mergedById.values())
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
            alert(copy.reportDownloadError);
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
            alert(copy.historyDownloadError);
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
            <h2 className="text-4xl font-serif font-bold text-foreground">{copy.title}</h2>
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
                    <span>{copy.downloadAll}</span>
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
                            <div className="mb-4 sm:mb-0">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                                        <FileText className="h-7 w-7 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-serif font-bold text-lg capitalize text-foreground">{translateModality(item.test_type, language)} {copy.analysis}</p>
                                        <p className="text-sm font-medium text-muted-foreground mt-0.5">{new Date(item.created_at).toLocaleString(locale)}</p>
                                    </div>
                                </div>
                                <TestArtifactPreview item={item} />
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/30">
                                <span className={`font-bold px-4 py-1.5 rounded-full text-sm uppercase tracking-wide ${getRiskColor(item.result)}`}>
                                    {translateRiskLevel((item.result as any)?.riskLevel || copy.pendingAnalysis, language)}
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
                                    <span className="hidden sm:inline">{copy.report}</span>
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16">
                        <div className="bg-muted/50 w-20 h-20 mx-auto rounded-[2rem] flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-serif text-2xl font-bold text-foreground">{copy.noHistoryTitle}</h3>
                        <p className="text-muted-foreground mt-2 font-medium">{copy.noHistoryBody}</p>
                    </div>
                )}
            </div>
        </Card>
    </div>
  );
};

export default History;
