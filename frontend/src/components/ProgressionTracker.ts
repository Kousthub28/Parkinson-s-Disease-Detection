/**
 * ProgressionTracker.ts
 * Analyzes trends across multiple sessions
 * Compares current session to historical baseline
 * Detects improvement vs. decline patterns
 */

import type { SessionReport, ProgressionTrend } from './therapyTypes';

interface MetricTrend {
  current: number;
  previous: number;
  change: number;  // percentage change
  trend: 'improving' | 'stable' | 'worsening';
  history: number[];  // Last 12 sessions
}

export class ProgressionTracker {
  /**
   * Get historical trend for a metric
   */
  static getTrendForMetric(
    currentValue: number,
    history: SessionReport[],
    metric: 'tremor' | 'speed' | 'rigidity' | 'freezing',
    timeWindowSessions: number = 6  // Compare to 6 prior sessions
  ): MetricTrend {
    const values: number[] = [];

    // Build history from reports
    if (history.length > 0) {
      const recentHistory = history.slice(0, timeWindowSessions);
      
      switch (metric) {
        case 'tremor':
          recentHistory.forEach(report => {
            values.push(report.tremorScore || 0);
          });
          break;
        case 'speed':
          recentHistory.forEach(report => {
            values.push(100 - (report.movementSpeedScore || 0)); // Convert back to bradykinesia
          });
          break;
        case 'rigidity':
          recentHistory.forEach(report => {
            values.push(report.rigidityScore || 0);
          });
          break;
        case 'freezing':
          recentHistory.forEach(report => {
            values.push(report.freezingEvents || 0);
          });
          break;
      }
    }

    const previousValue = values.length > 0 ? values[0] : currentValue;
    const change = previousValue !== 0
      ? ((currentValue - previousValue) / previousValue) * 100
      : 0;

    // Determine trend (for most metrics, lower is better; for freezing, lower is better)
    let trend: 'improving' | 'stable' | 'worsening';
    const threshold = 5; // 5% threshold for stable

    if (metric === 'freezing') {
      // For freezing, lower is better
      if (change < -threshold) trend = 'improving';
      else if (change > threshold) trend = 'worsening';
      else trend = 'stable';
    } else {
      // For tremor, speed, rigidity: lower is better
      if (change < -threshold) trend = 'improving';
      else if (change > threshold) trend = 'worsening';
      else trend = 'stable';
    }

    return {
      current: currentValue,
      previous: previousValue,
      change,
      trend,
      history: values,
    };
  }

  /**
   * Calculate overall progression status
   */
  static calculateProgressionTrend(
    currentReport: SessionReport,
    history: SessionReport[]
  ): ProgressionTrend {
    // Get trends for key metrics
    const tremorTrend = this.getTrendForMetric(
      currentReport.tremorScore,
      history,
      'tremor'
    );

    const speedTrend = this.getTrendForMetric(
      100 - currentReport.movementSpeedScore,
      history,
      'speed'
    );

    const rigidityTrend = this.getTrendForMetric(
      currentReport.rigidityScore || 0,
      history,
      'rigidity'
    );

    const freezingTrend = this.getTrendForMetric(
      currentReport.freezingEvents || 0,
      history,
      'freezing'
    );

    // Calculate overall trajectory
    const trends = [
      tremorTrend.trend,
      speedTrend.trend,
      rigidityTrend.trend,
    ];

    const improvingCount = trends.filter(t => t === 'improving').length;
    const worseningCount = trends.filter(t => t === 'worsening').length;

    let overallTrajectory: 'improving' | 'stable' | 'declining';
    if (improvingCount >= 2) {
      overallTrajectory = 'improving';
    } else if (worseningCount >= 2) {
      overallTrajectory = 'declining';
    } else {
      overallTrajectory = 'stable';
    }

    // Convert freezing "trend" to freezing "frequency"
    let freezingFrequency: 'none' | 'rare' | 'frequent';
    if ((currentReport.freezingEvents || 0) === 0) {
      freezingFrequency = 'none';
    } else if ((currentReport.freezingEvents || 0) <= 2) {
      freezingFrequency = 'rare';
    } else {
      freezingFrequency = 'frequent';
    }

    return {
      tremor: tremorTrend.trend,
      speed: speedTrend.trend,
      rigidity: rigidityTrend.trend,
      freezing: freezingFrequency,
      overallTrajectory,
    };
  }

  /**
   * Generate progression-aware recommendations
   */
  static generateProgressionRecommendations(
    currentReport: SessionReport,
    history: SessionReport[],
    overallRisk: string
  ): string[] {
    const progression = this.calculateProgressionTrend(currentReport, history);
    const recommendations: string[] = [];

    // Risk-based base recommendations
    if (overallRisk === 'HIGH') {
      recommendations.push('Do these seated exercises 5 days per week in short supervised blocks.');
      recommendations.push('Keep each session to 10-15 minutes and stop if you feel dizzy or unstable.');
      recommendations.push('Review these findings with a neurologist or physiotherapist.');
    } else if (overallRisk === 'MEDIUM') {
      recommendations.push('Do these seated exercises 4-5 days per week.');
      recommendations.push('Aim for one short daily routine focusing on smooth movement and posture.');
    } else {
      recommendations.push('Do these seated exercises 3-4 days per week.');
      recommendations.push('A short daily routine can help maintain mobility and coordination.');
    }

    // Progression-aware recommendations
    if (progression.overallTrajectory === 'improving') {
      recommendations.push('Great news! Your symptoms are improving—maintain this routine and consider adding standing exercises.');
    } else if (progression.overallTrajectory === 'declining') {
      recommendations.push('Your symptoms have declined recently. Increase exercise frequency and contact your neurologist to review medication.');
    } else {
      recommendations.push('Your symptoms are stable. Continue your current routine while working to improve form and consistency.');
    }

    // Metric-specific recommendations
    if (progression.tremor === 'worsening') {
      recommendations.push('Tremor is increasing—consider warm-up exercises before main routine and reduce caffeine intake.');
    }

    if (progression.speed === 'worsening') {
      recommendations.push('Movement speed is declining—focus on finger-tapping and seated-march exercises to maintain mobility.');
    }

    if (progression.rigidity === 'worsening') {
      recommendations.push('Joint stiffness is increasing—prioritize arm-raise and full-range motion exercises; consider physical therapy.');
    }

    if (progression.freezing === 'frequent') {
      recommendations.push('Freezing episodes are becoming frequent. Work with your neurologist on cueing strategies and medication timing.');
    } else if (progression.freezing === 'rare') {
      recommendations.push('Occasional freezing detected. Practice cueing techniques like rhythmic counting or visual markers.');
    }

    return recommendations;
  }

  /**
   * Compare current session to average of last N sessions
   */
  static getSessionComparison(
    currentReport: SessionReport,
    history: SessionReport[],
    windowSize: number = 3
  ) {
    if (history.length === 0) {
      return {
        baselineAverage: currentReport,
        vs: {
          tremorDiff: 0,
          speedDiff: 0,
          accuracyDiff: 0,
          riskChange: 'no change',
        },
      };
    }

    const baseline = history.slice(0, windowSize);
    const avgTremor = baseline.reduce((sum, r) => sum + r.tremorScore, 0) / baseline.length;
    const avgSpeed = baseline.reduce((sum, r) => sum + r.movementSpeedScore, 0) / baseline.length;
    const avgAccuracy = baseline.reduce((sum, r) => sum + r.averageAccuracy, 0) / baseline.length;

    const tremorDiff = currentReport.tremorScore - avgTremor;
    const speedDiff = currentReport.movementSpeedScore - avgSpeed;
    const accuracyDiff = currentReport.averageAccuracy - avgAccuracy;

    let riskChange = 'no change';
    if (currentReport.overallRisk !== baseline[0].overallRisk) {
      riskChange = `${baseline[0].overallRisk} → ${currentReport.overallRisk}`;
    }

    return {
      baselineAverage: {
        tremorScore: avgTremor,
        movementSpeedScore: avgSpeed,
        averageAccuracy: avgAccuracy,
      },
      vs: {
        tremorDiff,
        speedDiff,
        accuracyDiff,
        riskChange,
      },
    };
  }

  /**
   * Predict next month's risk level based on trajectory
   */
  static predictRiskLevel(
    currentReport: SessionReport,
    history: SessionReport[]
  ): {
    predicted: 'LOW' | 'MEDIUM' | 'HIGH';
    confidence: number;  // 0-1
    reasoning: string;
  } {
    if (history.length < 3) {
      return {
        predicted: currentReport.overallRisk as any,
        confidence: 0.3,
        reasoning: 'Not enough historical data for prediction. Need at least 3 prior sessions.',
      };
    }

    const progression = this.calculateProgressionTrend(currentReport, history);
    const recentRisks = history.slice(0, 6).map(r => r.overallRisk);
    const highCount = recentRisks.filter(r => r === 'HIGH').length;
    const mediumCount = recentRisks.filter(r => r === 'MEDIUM').length;

    let predicted: 'LOW' | 'MEDIUM' | 'HIGH' = currentReport.overallRisk as any;
    let confidence = 0.5;

    if (progression.overallTrajectory === 'declining') {
      // Risk increasing
      if (currentReport.overallRisk === 'LOW') {
        predicted = 'MEDIUM';
        confidence = 0.7;
      } else if (currentReport.overallRisk === 'MEDIUM') {
        predicted = 'HIGH';
        confidence = 0.7;
      }
    } else if (progression.overallTrajectory === 'improving') {
      // Risk decreasing
      if (currentReport.overallRisk === 'HIGH') {
        predicted = 'MEDIUM';
        confidence = 0.6;
      } else if (currentReport.overallRisk === 'MEDIUM') {
        predicted = 'LOW';
        confidence = 0.6;
      }
    } else {
      // Stable
      confidence = 0.75;
    }

    const reasoning = `Based on your ${progression.overallTrajectory} trajectory, we predict you will be at ${predicted} risk in 4 weeks.`;

    return { predicted, confidence, reasoning };
  }
}
