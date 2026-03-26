import { useEffect, useMemo, useState } from 'react';
import Card from './Card';
import { HeartPulse, Scale, Utensils, GlassWater, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { mongodb } from '../lib/mongodbClient';
import { useAuth } from '../hooks/useAuth';

type DietaryPreference = 'veg' | 'non-veg';

type Profile = {
  age: string;
  weightKg: string;
  heightCm: string;
  stage: string;
  medications: string;
  levodopaTime: string;
  dietaryPreference: DietaryPreference;
};

type IntakeLog = {
  date: string;
  intakeText: string;
  hydrationLiters: number;
  score: number;
};

type BmiEntry = {
  date: string;
  bmi: number;
};

type NutritionSnapshot = {
  profile: Profile;
  bmi: number | null;
  bmiClass: string;
  bmiHistory: BmiEntry[];
  logs: IntakeLog[];
};

type SectionKey = 'profile' | 'diet' | 'intake' | 'insights';

const PROFILE_KEY = 'pd_nutrition_profile';
const LOGS_KEY = 'pd_nutrition_logs';
const BMI_HISTORY_KEY = 'pd_bmi_history';

const defaultProfile: Profile = {
  age: '',
  weightKg: '',
  heightCm: '',
  stage: '',
  medications: '',
  levodopaTime: '',
  dietaryPreference: 'veg',
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const classifyBmi = (bmi: number) => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};

const getBmiInsights = (classification: string) => {
  if (classification === 'Underweight') {
    return [
      'Low body weight can reduce muscle strength and increase fatigue in Parkinson\'s disease.',
      'Try energy-dense but healthy foods like nuts, dairy, tofu, eggs, and soft cooked grains.',
      'Ask your doctor if unintentional weight loss needs medical review.',
    ];
  }

  if (classification === 'Normal') {
    return [
      'Your BMI is in a healthy range, which supports better movement and stamina.',
      'Maintain balanced meals, hydration, and regular meal timing with medication.',
      'Keep tracking weekly so changes can be identified early.',
    ];
  }

  if (classification === 'Overweight') {
    return [
      'Extra weight can increase mobility strain and fall risk in Parkinson\'s disease.',
      'Prefer high-fiber meals, portion control, and regular light activity as advised by your care team.',
      'Limit sugary and fried foods to support better symptom control.',
    ];
  }

  return [
    'Higher BMI may increase inflammation, fatigue, and movement burden in Parkinson\'s disease.',
    'Focus on structured meal timing, low-processed foods, and physician-guided weight management.',
    'Consider dietitian support for a safe long-term plan.',
  ];
};

const getDietPlan = (preference: DietaryPreference, levodopaTime: string) => {
  const breakfast = preference === 'veg'
    ? ['Oats porridge with chia/flax seeds', 'Stewed apple or banana', 'Warm ginger-turmeric milk (low sugar)']
    : ['Vegetable omelette with whole grain toast', 'Papaya or berries', 'Unsweetened yogurt'];

  const lunch = preference === 'veg'
    ? ['Brown rice or millet', 'Lentil dal (moderate portion)', 'Cooked spinach + carrots', 'Curd']
    : ['Grilled fish/chicken (small to moderate)', 'Brown rice or quinoa', 'Mixed cooked vegetables', 'Curd'];

  const dinner = preference === 'veg'
    ? ['Vegetable soup + paneer/tofu', 'Soft chapati', 'Sauteed greens']
    : ['Light fish/chicken soup', 'Soft chapati or quinoa', 'Steamed vegetables'];

  const snacks = [
    'Mid-morning: nuts + fruit',
    'Evening: roasted chana / yogurt / fruit smoothie',
    'If constipation: add soaked prunes or figs',
  ];

  const hydration = [
    'Drink 1.8 to 2.3 liters water daily unless your doctor has fluid limits.',
    'Keep a water bottle nearby and sip every 1 to 2 hours.',
    'Include clear soups/coconut water for hydration variety.',
  ];

  const medAlert = levodopaTime
    ? `Levodopa timing note: around ${levodopaTime}, keep high-protein meals at least 1 hour before or after medication.`
    : 'If you use Levodopa, keep high-protein meals 1 hour away from medicine timing for better absorption.';

  return { breakfast, lunch, dinner, snacks, hydration, medAlert };
};

const evaluateIntake = (intakeText: string, hydrationLiters: number) => {
  const text = intakeText.toLowerCase();
  const positive = ['vegetable', 'fruit', 'whole grain', 'oats', 'dal', 'lentil', 'salad', 'fish', 'nuts', 'water', 'soup'];
  const negative = ['fried', 'soda', 'cola', 'sugary', 'pastry', 'chips', 'processed', 'junk'];
  const fiberSignals = ['oats', 'fruit', 'vegetable', 'whole grain', 'dal', 'lentil', 'salad', 'seeds'];

  const positiveHits = positive.filter((k) => text.includes(k)).length;
  const negativeHits = negative.filter((k) => text.includes(k)).length;
  const fiberHits = fiberSignals.filter((k) => text.includes(k)).length;

  const hydrationScore = hydrationLiters >= 2 ? 20 : hydrationLiters >= 1.5 ? 12 : 5;
  const score = clamp(45 + positiveHits * 8 - negativeHits * 9 + hydrationScore, 0, 100);

  const suggestions: string[] = [];
  if (negativeHits > 0) suggestions.push('Reduce fried/sugary/processed foods and replace with cooked vegetables or fruit.');
  if (hydrationLiters < 1.8) suggestions.push('Increase water intake gradually to around 2 liters/day unless medically restricted.');
  if (fiberHits < 2) suggestions.push('Add more fiber (oats, vegetables, fruit, lentils) to help bowel regularity.');
  if (positiveHits < 2) suggestions.push('Add one Parkinson-friendly plate: cooked vegetables + protein + whole grain.');
  if (suggestions.length === 0) suggestions.push('Great job. Keep the same pattern and keep protein timing aligned with medication.');

  return {
    score,
    isFriendly: score >= 70,
    suggestions,
  };
};

const NutritionAssistantCard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [bmi, setBmi] = useState<number | null>(null);
  const [bmiClass, setBmiClass] = useState<string>('');
  const [intakeText, setIntakeText] = useState('');
  const [hydrationLiters, setHydrationLiters] = useState<string>('');
  const [logs, setLogs] = useState<IntakeLog[]>([]);
  const [bmiHistory, setBmiHistory] = useState<BmiEntry[]>([]);
  const [intakeResult, setIntakeResult] = useState<{ score: number; isFriendly: boolean; suggestions: string[] } | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    profile: true,
    diet: false,
    intake: false,
    insights: false,
  });

  useEffect(() => {
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    const savedLogs = localStorage.getItem(LOGS_KEY);
    const savedBmiHistory = localStorage.getItem(BMI_HISTORY_KEY);

    if (savedProfile) {
      try {
        setProfile({ ...defaultProfile, ...JSON.parse(savedProfile) });
      } catch {
        setProfile(defaultProfile);
      }
    }

    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch {
        setLogs([]);
      }
    }

    if (savedBmiHistory) {
      try {
        setBmiHistory(JSON.parse(savedBmiHistory));
      } catch {
        setBmiHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadLatestNutritionSnapshot = async () => {
      try {
        const { data, error } = await (mongodb as any)
          .from('tests')
          .select('*')
          .eq('test_type', 'nutrition')
          .order('created_at', { ascending: false });

        if (error || !Array.isArray(data) || data.length === 0) return;

        const latest = data[0];
        const snapshot = (latest?.result as any)?.nutrition as NutritionSnapshot | undefined;
        if (!snapshot) return;

        const hasLocalProfile = Boolean(localStorage.getItem(PROFILE_KEY));
        const hasLocalLogs = Boolean(localStorage.getItem(LOGS_KEY));

        if (!hasLocalProfile) {
          setProfile({ ...defaultProfile, ...snapshot.profile });
        }
        if (!hasLocalLogs) {
          setLogs(Array.isArray(snapshot.logs) ? snapshot.logs : []);
          setBmiHistory(Array.isArray(snapshot.bmiHistory) ? snapshot.bmiHistory : []);
          if (typeof snapshot.bmi === 'number') setBmi(snapshot.bmi);
          if (snapshot.bmiClass) setBmiClass(snapshot.bmiClass);
        }
      } catch {
        // Keep local experience even if backend read fails.
      }
    };

    loadLatestNutritionSnapshot();
  }, [user]);

  const persistNutritionSnapshot = async (snapshot: NutritionSnapshot) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(snapshot.profile));
    localStorage.setItem(BMI_HISTORY_KEY, JSON.stringify(snapshot.bmiHistory));
    localStorage.setItem(LOGS_KEY, JSON.stringify(snapshot.logs));

    if (!user) {
      setSyncMessage('Saved locally. Sign in to sync with cloud reports.');
      return;
    }

    try {
      const payload = {
        test_type: 'nutrition',
        raw_storage_path: null,
        status: 'completed',
        result: {
          nutrition: snapshot,
          summary: {
            latestBmi: snapshot.bmi,
            bmiClass: snapshot.bmiClass,
            latestNutritionScore: snapshot.logs[0]?.score ?? null,
            latestHydrationLiters: snapshot.logs[0]?.hydrationLiters ?? null,
          },
        },
        confidence: null,
        model_versions: { nutritionAssistant: 'v1' },
      };

      const { error } = await (mongodb as any).from('tests').insert(payload);
      if (error) throw new Error(error.message || 'Cloud sync failed');
      setSyncMessage('Saved to MongoDB and local storage.');
    } catch {
      setSyncMessage('Saved locally. Cloud sync will retry next update.');
    }
  };

  const handleProfileChange = (key: keyof Profile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const calculateAndSaveBmi = async () => {
    const weight = Number(profile.weightKg);
    const heightCm = Number(profile.heightCm);
    if (!weight || !heightCm) return;

    const heightMeters = heightCm / 100;
    const computedBmi = weight / (heightMeters * heightMeters);
    const rounded = Number(computedBmi.toFixed(1));
    const category = classifyBmi(rounded);

    setBmi(rounded);
    setBmiClass(category);

    const nextHistory = [
      { date: new Date().toISOString(), bmi: rounded },
      ...bmiHistory,
    ].slice(0, 30);
    setBmiHistory(nextHistory);

    await persistNutritionSnapshot({
      profile,
      bmi: rounded,
      bmiClass: category,
      bmiHistory: nextHistory,
      logs,
    });
  };

  const dietPlan = useMemo(() => getDietPlan(profile.dietaryPreference, profile.levodopaTime), [profile.dietaryPreference, profile.levodopaTime]);

  const weeklySummary = useMemo(() => {
    const last7 = logs.slice(0, 7);
    const nutritionScore = last7.length
      ? Math.round(last7.reduce((acc, item) => acc + item.score, 0) / last7.length)
      : 0;

    const latestBmi = bmiHistory[0]?.bmi ?? null;
    const olderBmi = bmiHistory[Math.min(6, bmiHistory.length - 1)]?.bmi ?? null;
    let bmiTrend = 'Stable';
    if (latestBmi !== null && olderBmi !== null) {
      if (latestBmi > olderBmi + 0.2) bmiTrend = 'Increase';
      else if (latestBmi < olderBmi - 0.2) bmiTrend = 'Decrease';
    }

    const hydrationLowDays = last7.filter((l) => l.hydrationLiters < 1.8).length;
    const lowScoreDays = last7.filter((l) => l.score < 60).length;
    const deficiencies: string[] = [];

    if (hydrationLowDays >= 3) deficiencies.push('Hydration was low on multiple days.');
    if (lowScoreDays >= 3) deficiencies.push('Meal quality score was low several times.');
    if (!deficiencies.length) deficiencies.push('No major deficiencies detected this week.');

    const improvements: string[] = [
      'Plan meal timings around medication reminders.',
      'Target 2 portions of fruit and 3 portions of vegetables daily.',
      'Add one fiber-rich food at each main meal.',
    ];

    return { nutritionScore, bmiTrend, deficiencies, improvements };
  }, [logs, bmiHistory]);

  const submitIntake = async () => {
    const hydration = Number(hydrationLiters) || 0;
    if (!intakeText.trim()) return;

    const result = evaluateIntake(intakeText, hydration);
    setIntakeResult(result);

    const nextLogs: IntakeLog[] = [
      {
        date: new Date().toISOString(),
        intakeText: intakeText.trim(),
        hydrationLiters: hydration,
        score: result.score,
      },
      ...logs,
    ].slice(0, 30);

    setLogs(nextLogs);

    await persistNutritionSnapshot({
      profile,
      bmi,
      bmiClass,
      bmiHistory,
      logs: nextLogs,
    });

    setIntakeText('');
    setHydrationLiters('');
  };

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card className="rounded-organic-1 bg-background/70 dark:bg-accent/35">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-3 rounded-2xl bg-primary/15">
          <HeartPulse className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-serif text-2xl font-bold text-foreground">AI Health Assistant - Parkinson Nutrition</h3>
          <p className="text-sm text-muted-foreground">Simple daily guidance for diet, BMI, hydration, and medication-friendly meal timing.</p>
        </div>
      </div>

      {syncMessage && (
        <div className="mt-4 rounded-xl border border-border/40 bg-background/60 px-4 py-2 text-sm text-muted-foreground">
          {syncMessage}
        </div>
      )}

      <div className="space-y-4 mt-4">
        <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
          <button
            type="button"
            onClick={() => toggleSection('profile')}
            className="w-full flex items-center justify-between text-left"
          >
            <h4 className="font-bold text-foreground flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> 1) Your Details + BMI</h4>
            {openSections.profile ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {openSections.profile && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={profile.age} onChange={(e) => handleProfileChange('age', e.target.value)} placeholder="Age" className="px-3 py-2 rounded-xl bg-background border border-border/60" />
                <input value={profile.weightKg} onChange={(e) => handleProfileChange('weightKg', e.target.value)} placeholder="Weight (kg)" className="px-3 py-2 rounded-xl bg-background border border-border/60" />
                <input value={profile.heightCm} onChange={(e) => handleProfileChange('heightCm', e.target.value)} placeholder="Height (cm)" className="px-3 py-2 rounded-xl bg-background border border-border/60" />
                <input value={profile.stage} onChange={(e) => handleProfileChange('stage', e.target.value)} placeholder="Parkinson's stage (if known)" className="px-3 py-2 rounded-xl bg-background border border-border/60" />
                <input value={profile.medications} onChange={(e) => handleProfileChange('medications', e.target.value)} placeholder="Medications" className="px-3 py-2 rounded-xl bg-background border border-border/60 sm:col-span-2" />
                <input value={profile.levodopaTime} onChange={(e) => handleProfileChange('levodopaTime', e.target.value)} placeholder="Levodopa timing (e.g., 8am, 2pm)" className="px-3 py-2 rounded-xl bg-background border border-border/60 sm:col-span-2" />
                <select value={profile.dietaryPreference} onChange={(e) => handleProfileChange('dietaryPreference', e.target.value)} className="px-3 py-2 rounded-xl bg-background border border-border/60 sm:col-span-2">
                  <option value="veg">Diet preference: Vegetarian</option>
                  <option value="non-veg">Diet preference: Non-Vegetarian</option>
                </select>
              </div>
              <button onClick={calculateAndSaveBmi} className="px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
                Calculate BMI
              </button>

              {bmi !== null && (
                <div className="rounded-xl border border-border/40 bg-background/60 p-3">
                  <p className="font-semibold text-foreground">BMI: {bmi.toFixed(1)} ({bmiClass})</p>
                  <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    {getBmiInsights(bmiClass).map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
          <button
            type="button"
            onClick={() => toggleSection('diet')}
            className="w-full flex items-center justify-between text-left"
          >
            <h4 className="font-bold text-foreground flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /> 2) Daily Diet Plan</h4>
            {openSections.diet ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {openSections.diet && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-4">
              <div className="rounded-xl bg-background/70 border border-border/40 p-3">
                <p className="font-semibold">Breakfast</p>
                <ul className="list-disc pl-5 text-muted-foreground mt-1 space-y-1">{dietPlan.breakfast.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div className="rounded-xl bg-background/70 border border-border/40 p-3">
                <p className="font-semibold">Lunch</p>
                <ul className="list-disc pl-5 text-muted-foreground mt-1 space-y-1">{dietPlan.lunch.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div className="rounded-xl bg-background/70 border border-border/40 p-3">
                <p className="font-semibold">Dinner</p>
                <ul className="list-disc pl-5 text-muted-foreground mt-1 space-y-1">{dietPlan.dinner.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div className="rounded-xl bg-background/70 border border-border/40 p-3">
                <p className="font-semibold">Snacks + Hydration</p>
                <ul className="list-disc pl-5 text-muted-foreground mt-1 space-y-1">
                  {dietPlan.snacks.map((x) => <li key={x}>{x}</li>)}
                  {dietPlan.hydration.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
          <button
            type="button"
            onClick={() => toggleSection('intake')}
            className="w-full flex items-center justify-between text-left"
          >
            <h4 className="font-bold text-foreground flex items-center gap-2"><GlassWater className="h-4 w-4 text-primary" /> 3) Track Today's Intake</h4>
            {openSections.intake ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {openSections.intake && (
            <div className="mt-4 space-y-3">
              <textarea
                value={intakeText}
                onChange={(e) => setIntakeText(e.target.value)}
                rows={4}
                placeholder="Tell me what you ate today (breakfast, lunch, dinner, snacks)..."
                className="w-full px-3 py-2 rounded-xl bg-background border border-border/60"
              />
              <input
                value={hydrationLiters}
                onChange={(e) => setHydrationLiters(e.target.value)}
                placeholder="Water intake today (liters)"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border/60"
              />
              <button onClick={submitIntake} className="px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/90 transition-colors">
                Evaluate Intake
              </button>

              {intakeResult && (
                <div className="rounded-xl border border-border/40 bg-background/60 p-3">
                  <p className="font-semibold flex items-center gap-2">
                    {intakeResult.isFriendly ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                    Parkinson-friendly score: {intakeResult.score}/100
                  </p>
                  <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    {intakeResult.suggestions.map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
          <button
            type="button"
            onClick={() => toggleSection('insights')}
            className="w-full flex items-center justify-between text-left"
          >
            <h4 className="font-bold text-foreground">4) Smart Alerts + Weekly Insights</h4>
            {openSections.insights ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {openSections.insights && (
            <div className="space-y-4 mt-4">
              <div className="rounded-xl bg-background/70 border border-border/40 p-3 text-sm">
                <p className="font-semibold mb-1">Smart Alerts</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>{dietPlan.medAlert}</li>
                  <li>Hydration reminder: sip water every 1 to 2 hours during daytime.</li>
                  <li>Fiber reminder: include at least one fiber source per meal to reduce constipation risk.</li>
                </ul>
              </div>

              <div className="rounded-xl bg-background/70 border border-border/40 p-3 text-sm">
                <p className="font-semibold mb-2">Weekly Insights</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="rounded-lg bg-background/80 border border-border/40 p-2">
                    <p className="text-xs text-muted-foreground">Nutrition Score</p>
                    <p className="font-bold text-lg text-foreground">{weeklySummary.nutritionScore}/100</p>
                  </div>
                  <div className="rounded-lg bg-background/80 border border-border/40 p-2">
                    <p className="text-xs text-muted-foreground">BMI Trend</p>
                    <p className="font-bold text-lg text-foreground">{weeklySummary.bmiTrend}</p>
                  </div>
                </div>
                <p className="font-semibold">Deficiencies</p>
                <ul className="list-disc pl-5 text-muted-foreground mt-1 space-y-1">
                  {weeklySummary.deficiencies.map((d) => <li key={d}>{d}</li>)}
                </ul>
                <p className="font-semibold mt-3">Improvements</p>
                <ul className="list-disc pl-5 text-muted-foreground mt-1 space-y-1">
                  {weeklySummary.improvements.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default NutritionAssistantCard;
