import NutritionAssistantCard from '../components/NutritionAssistantCard';
import { HeartPulse, Sparkles, Utensils, Droplets, Pill } from 'lucide-react';

const NutritionPlanner = () => {
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-organic-3 border border-border/50 bg-background/70 dark:bg-accent/35 p-6 md:p-8 shadow-soft">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-primary/15">
            <HeartPulse className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-4xl font-serif font-bold text-foreground tracking-tight">Nutrition Planner</h2>
            <p className="text-muted-foreground mt-2 max-w-3xl">
              Personalized Parkinson-friendly nutrition support: BMI tracking, meal planning, hydration guidance,
              and medication-aware food timing.
            </p>
          </div>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
          <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Step 1
            </p>
            <p className="font-semibold text-foreground mt-1">Fill Your Profile + BMI</p>
            <p className="text-sm text-muted-foreground mt-1">Add age, weight, height, stage, medications, and Levodopa timing.</p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-2">
              <Utensils className="h-3.5 w-3.5" /> Step 2
            </p>
            <p className="font-semibold text-foreground mt-1">Use Daily Diet Plan</p>
            <p className="text-sm text-muted-foreground mt-1">Get breakfast, lunch, dinner, snack, and hydration recommendations.</p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-2">
              <Droplets className="h-3.5 w-3.5" /> Step 3
            </p>
            <p className="font-semibold text-foreground mt-1">Track + Improve</p>
            <p className="text-sm text-muted-foreground mt-1">Log food intake daily and follow weekly score/deficiency suggestions.</p>
          </div>
        </div>

        <div className="relative mt-4 rounded-2xl border border-border/40 bg-background/60 p-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Pill className="h-4 w-4 text-secondary" /> Medication Reminder
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Keep high-protein meals at least 1 hour before or after Levodopa to support better absorption.
          </p>
        </div>
      </div>

      <NutritionAssistantCard />
    </div>
  );
};

export default NutritionPlanner;
