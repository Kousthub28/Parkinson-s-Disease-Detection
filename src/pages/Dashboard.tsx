import { useEffect, useState, useCallback } from 'react';
import Card from '../components/Card';
import Chart from '../components/Chart';
import { Activity, FileText, BarChart, LoaderCircle, TrendingUp, PieChart, List } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Test } from '../types/database';
import { Link } from 'react-router-dom';

const getRiskScoreChartOption = (tests: Test[]) => {
  const chartData = tests
    .filter(t => (t.result as any)?.riskScore)
    .map(t => ({
      date: new Date(t.created_at).toLocaleDateString(),
      score: (t.result as any).riskScore,
    }))
    .reverse(); // oldest to newest

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: chartData.map(d => d.date),
      axisLine: { lineStyle: { color: '#4A5568' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 10,
      axisLine: { lineStyle: { color: '#4A5568' } },
      splitLine: { lineStyle: { color: '#2D3748' } },
    },
    series: [{
      name: 'Risk Score',
      type: 'line',
      smooth: true,
      data: chartData.map(d => d.score),
      itemStyle: { color: '#38bdf8' },
      areaStyle: {
          color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#38bdf8' }, { offset: 1, color: 'rgba(56, 189, 248, 0)' }]
          }
      }
    }],
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  };
};

const getDistributionChartOption = (tests: Test[]) => {
    const distribution = tests.reduce((acc, test) => {
        acc[test.test_type] = (acc[test.test_type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item' },
        legend: {
            orient: 'vertical',
            left: 'left',
            textStyle: { color: '#A0AEC0' }
        },
        series: [{
            name: 'Test Types',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            label: { show: false },
            emphasis: {
                label: { show: true, fontSize: '20', fontWeight: 'bold' }
            },
            data: Object.entries(distribution).map(([name, value]) => ({ value, name })),
        }]
    };
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTests: 0,
    avgRisk: 'N/A',
    lastTestDate: 'N/A',
  });

  const calculateStats = useCallback((testsData: Test[]) => {
    if (!testsData || testsData.length === 0) {
        setStats({ totalTests: 0, avgRisk: 'N/A', lastTestDate: 'N/A' });
        return;
    };

    const totalTests = testsData.length;
    
    const lastTestDate = new Date(testsData[0].created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastTestDate.getTime()) / (1000 * 3600 * 24));
    const lastTestDateStr = diffDays === 0 ? 'Today' : `${diffDays}d ago`;

    const testsWithRisk = testsData.filter(t => (t.result as any)?.riskScore);
    const avgRisk = testsWithRisk.length > 0 
        ? (testsWithRisk.reduce((acc, t) => acc + (t.result as any).riskScore, 0) / testsWithRisk.length).toFixed(1)
        : 'N/A';
    
    setStats({ totalTests, avgRisk, lastTestDate: lastTestDateStr });
  }, []);

  const fetchTests = useCallback(async () => {
    if (!user) {
        return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tests:', error);
    } else {
      setTests(data ?? []);
      calculateStats(data ?? []);
    }

    setLoading(false);
  }, [calculateStats, user]);

  useEffect(() => {
    if (authLoading) {
        return;
    }

    if (!user) {
        setTests([]);
        calculateStats([]);
        setLoading(false);
        return;
    }

    let isMounted = true;

    const initialize = async () => {
        if (!isMounted) return;
        await fetchTests();
    };

    initialize();

  const channel = supabase.channel('realtime-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tests', filter: `patient_id=eq.${user.id}`},
    async (payload: unknown) => {
      console.log('Realtime change received!', payload);
            await fetchTests();
        })
        .subscribe();

    return () => {
        isMounted = false;
        supabase.removeChannel(channel);
    };
  }, [authLoading, user, fetchTests, calculateStats]);

  if (authLoading || loading) {
    return <div className="flex h-full w-full items-center justify-center"><LoaderCircle className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center space-y-4 text-center">
        <h2 className="text-2xl font-semibold">Sign in to view your dashboard</h2>
        <p className="text-muted-foreground max-w-md">
          We couldn&apos;t find an active session. Please sign in again to access your personal analytics and test history.
        </p>
        <Link
          to="/auth"
          className="rounded-lg bg-primary px-6 py-2 text-primary-foreground hover:opacity-90"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Tests</p>
            <BarChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.totalTests}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Average Risk</p>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2 text-yellow-400">{stats.avgRisk} / 10</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Last Test</p>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.lastTestDate}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 h-80">
            <h3 className="font-semibold mb-4 flex items-center"><TrendingUp size={18} className="mr-2" /> Risk Score Over Time</h3>
            {tests.length > 0 ? <Chart option={getRiskScoreChartOption(tests)} /> : <p className="text-center text-muted-foreground pt-16">No test results yet.</p>}
        </Card>
        <Card className="lg:col-span-2 h-80">
            <h3 className="font-semibold mb-4 flex items-center"><PieChart size={18} className="mr-2" /> Test Type Distribution</h3>
            {tests.length > 0 ? <Chart option={getDistributionChartOption(tests)} /> : <p className="text-center text-muted-foreground pt-16">No tests performed yet.</p>}
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold flex items-center"><List size={18} className="mr-2" /> Recent Tests</h3>
            <Link to="/history" className="text-sm font-medium text-primary-foreground hover:underline">View All</Link>
        </div>
        <div className="space-y-2">
          {tests.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-4">
                <span className="font-medium capitalize">{item.test_type} Test</span>
                <span className="text-sm text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
              <span className="text-sm font-semibold text-primary-foreground bg-accent px-2 py-1 rounded capitalize">
                { (item.result as any)?.riskScore ? `Risk: ${(item.result as any).riskScore}/10` : 'Processing...' }
              </span>
            </div>
          ))}
          {tests.length === 0 && <p className="text-center text-muted-foreground py-4">You haven't performed any tests yet.</p>}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
