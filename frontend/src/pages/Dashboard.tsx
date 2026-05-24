import { useEffect, useRef, useState } from 'react';
import Card from '../components/Card';
import Chart from '../components/Chart';
import DigitalTwinCard from '../components/DigitalTwinCard';
import { Activity, FileText, BarChart, LoaderCircle, TrendingUp, PieChart, List, HeartPulse, Droplets, ArrowRight, CalendarDays, Video, ClipboardList, MessageSquare } from 'lucide-react';
import { mongodb } from '../lib/mongodbClient';
import { TEST_QUERY_TIMEOUT_MS } from '../services/testPersistence';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { Test } from '../types/database';
import { Link } from 'react-router-dom';
import { getLatestByModality } from '../services/fusionScoreService';
import { ensureUnifiedReport, getAppointments, getReports } from '../services/healthcareApi';
import type { AppointmentRecord, UnifiedReport } from '../types/healthcare';
import { collapseAppointments, isRejectedAppointment, normalizeAppointmentStatus } from '../utils/appointments';

const PROFILE_KEY = 'pd_nutrition_profile';
const LOGS_KEY = 'pd_nutrition_logs';
const BMI_HISTORY_KEY = 'pd_bmi_history';
const LOCAL_APPOINTMENTS_KEY = 'local_appointments';

const dashboardCopy = {
  en: {
    notAvailable: 'N/A',
    today: 'Today',
    daysAgo: (days: number) => `${days}d ago`,
    signInTitle: 'Sign in to view your dashboard',
    signInBody: 'We couldn\'t find an active session. Please sign in again to access your personal analytics and test history.',
    goToSignIn: 'Go to Sign In',
    totalTests: 'Total Tests',
    averageRisk: 'Average Risk',
    lastTest: 'Last Test',
    averageRiskTimeframe: 'Timeframe for Average Risk Score',
    allTime: 'All Time',
    last30Days: 'Last 30 Days',
    last5Tests: 'Last 5 Tests',
    latestUnifiedReport: 'Latest Unified Report',
    unifiedReportSubtitle: 'AI results and doctor review stay together in one report.',
    updateAiReport: 'Update AI Report',
    status: 'Status',
    aiRisk: 'AI Risk',
    doctorNotes: 'Doctor Notes',
    available: 'Available',
    pending: 'Pending',
    prescription: 'Prescription',
    summary: 'Summary',
    reportReadyFallback: 'Your latest AI report is ready for review. Book an appointment to get a doctor prescription added to the same report.',
    viewReport: 'View Report',
    bookAppointment: 'Book Appointment',
    noUnifiedReport: 'No unified report yet',
    noUnifiedReportBody: 'Save your comprehensive AI screening first, then book a doctor review.',
    createAiReport: 'Create AI Report',
    appointmentsCalls: 'Appointments & Calls',
    appointmentsSubtitle: 'Move from AI screening to doctor consultation without leaving the same workflow.',
    nextAppointment: 'Next Appointment',
    assignedDoctor: 'Assigned Doctor',
    consultation: 'consultation',
    joinCall: 'Join Call',
    chat: 'Chat',
    waitingForDoctor: 'Waiting for doctor',
    openLinkedReport: 'Open Linked Report',
    latestPrescription: 'Latest Prescription',
    noAppointments: 'No appointments scheduled',
    noAppointmentsBody: 'Choose an approved doctor and link your latest report to start clinical review.',
    riskScoreSeries: 'Risk Score',
    riskScoreTrend: 'Risk Score Trend',
    riskTrendSubtitle: 'Recent progression across your completed screening tests.',
    latestRisk: 'Latest Risk',
    trend: 'Trend',
    delta: 'Delta',
    dataPoints: 'Data Points',
    stable: 'Stable',
    up: 'Up',
    down: 'Down',
    notEnoughData: 'Not Enough Data',
    notEnoughDataBody: 'Complete at least 2 tests to visualize your changing risk over time.',
    testTypeSeries: 'Test Types',
    total: 'Total',
    testTypeDistribution: 'Test Type Distribution',
    testTypeDistributionBody: 'Modality balance across your latest saved screenings.',
    noTestsTaken: 'No Tests Taken',
    noTestsTakenBody: 'Your analysis modalities will appear here once you take your first test.',
    recentTests: 'Recent Tests',
    viewAll: 'View All',
    riskPrefix: 'Risk',
    processing: 'Processing...',
    noRecentTests: 'You haven\'t performed any tests yet.',
    testHistories: 'Test Histories & Doctor Feedback',
    testHistoriesBody: 'All reviewed tests with doctor notes and recommendations',
    doctorFeedback: 'Doctor Feedback:',
    viewFullReport: 'View Full Report',
    noReviewedReports: 'No reviewed reports yet',
    noReviewedReportsBody: 'Book a doctor consultation to get your report reviewed and receive feedback',
    nutritionSummary: 'Nutrition Summary',
    nutritionSummaryBody: 'Quick overview. Open Nutrition Planner for full diet guidance and tracking.',
    openPlanner: 'Open Planner',
    latestBmi: 'Latest BMI',
    nutritionScore: 'Nutrition Score',
    lastTrackedMealQuality: 'Last tracked meal quality',
    hydration: 'Hydration',
    dailyIntakeSnapshot: 'Daily intake snapshot',
    profileSetup: 'Profile Setup',
    completeDetailsInPlanner: 'Complete details in planner',
  },
  kn: {
    notAvailable: 'ಲಭ್ಯವಿಲ್ಲ',
    today: 'ಇಂದು',
    daysAgo: (days: number) => `${days} ದಿನಗಳ ಹಿಂದೆ`,
    signInTitle: 'ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ',
    signInBody: 'ಸಕ್ರಿಯ ಸೆಷನ್ ಕಂಡುಬರಲಿಲ್ಲ. ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಪರೀಕ್ಷಾ ಇತಿಹಾಸ ನೋಡಲು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.',
    goToSignIn: 'ಸೈನ್ ಇನ್‌ಗೆ ಹೋಗಿ',
    totalTests: 'ಒಟ್ಟು ಪರೀಕ್ಷೆಗಳು',
    averageRisk: 'ಸರಾಸರಿ ಅಪಾಯ',
    lastTest: 'ಕೊನೆಯ ಪರೀಕ್ಷೆ',
    averageRiskTimeframe: 'ಸರಾಸರಿ ಅಪಾಯ ಸ್ಕೋರ್ ಅವಧಿ',
    allTime: 'ಎಲ್ಲಾ ಸಮಯ',
    last30Days: 'ಕಳೆದ 30 ದಿನಗಳು',
    last5Tests: 'ಕೊನೆಯ 5 ಪರೀಕ್ಷೆಗಳು',
    latestUnifiedReport: 'ಇತ್ತೀಚಿನ ಏಕೀಕೃತ ವರದಿ',
    unifiedReportSubtitle: 'ಎಐ ಫಲಿತಾಂಶಗಳು ಮತ್ತು ವೈದ್ಯರ ವಿಮರ್ಶೆ ಒಂದೇ ವರದಿಯಲ್ಲಿ ಇರುತ್ತವೆ.',
    updateAiReport: 'ಎಐ ವರದಿ ನವೀಕರಿಸಿ',
    status: 'ಸ್ಥಿತಿ',
    aiRisk: 'ಎಐ ಅಪಾಯ',
    doctorNotes: 'ವೈದ್ಯರ ಟಿಪ್ಪಣಿಗಳು',
    available: 'ಲಭ್ಯ',
    pending: 'ಬಾಕಿ',
    prescription: 'ಔಷಧ ಪತ್ರಿಕೆ',
    summary: 'ಸಾರಾಂಶ',
    reportReadyFallback: 'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಎಐ ವರದಿ ವಿಮರ್ಶೆಗೆ ಸಿದ್ಧವಾಗಿದೆ. ಅದೇ ವರದಿಗೆ ವೈದ್ಯರ ಔಷಧ ಪತ್ರಿಕೆ ಸೇರಿಸಲು ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ.',
    viewReport: 'ವರದಿ ನೋಡಿ',
    bookAppointment: 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ',
    noUnifiedReport: 'ಇನ್ನೂ ಏಕೀಕೃತ ವರದಿ ಇಲ್ಲ',
    noUnifiedReportBody: 'ಮೊದಲು ನಿಮ್ಮ ಸಮಗ್ರ ಎಐ ಪರೀಕ್ಷೆಯನ್ನು ಉಳಿಸಿ, ನಂತರ ವೈದ್ಯರ ವಿಮರ್ಶೆ ಬುಕ್ ಮಾಡಿ.',
    createAiReport: 'ಎಐ ವರದಿ ರಚಿಸಿ',
    appointmentsCalls: 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು ಮತ್ತು ಕರೆಗಳು',
    appointmentsSubtitle: 'ಎಐ ಪರಿಶೀಲನೆಯಿಂದ ವೈದ್ಯರ ಸಲಹೆಯವರೆಗೆ ಅದೇ ವರ್ಕ್‌ಫ್ಲೋದಲ್ಲೇ ಸಾಗಿರಿ.',
    nextAppointment: 'ಮುಂದಿನ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್',
    assignedDoctor: 'ನಿಯೋಜಿತ ವೈದ್ಯರು',
    consultation: 'ಸಲಹೆ',
    joinCall: 'ಕರೆಗೆ ಸೇರಿ',
    chat: 'ಚಾಟ್',
    waitingForDoctor: 'ವೈದ್ಯರಿಗಾಗಿ ನಿರೀಕ್ಷೆಯಲ್ಲಿ',
    openLinkedReport: 'ಸಂಬಂಧಿತ ವರದಿ ತೆರೆಯಿರಿ',
    latestPrescription: 'ಇತ್ತೀಚಿನ ಔಷಧ ಪತ್ರಿಕೆ',
    noAppointments: 'ಯಾವುದೇ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಇಲ್ಲ',
    noAppointmentsBody: 'ಕ್ಲಿನಿಕಲ್ ವಿಮರ್ಶೆ ಪ್ರಾರಂಭಿಸಲು ಅನುಮೋದಿತ ವೈದ್ಯರನ್ನು ಆಯ್ಕೆ ಮಾಡಿ ಮತ್ತು ನಿಮ್ಮ ಇತ್ತೀಚಿನ ವರದಿಯನ್ನು ಲಿಂಕ್ ಮಾಡಿ.',
    riskScoreSeries: 'ಅಪಾಯ ಸ್ಕೋರ್',
    riskScoreTrend: 'ಅಪಾಯ ಸ್ಕೋರ್ ಪ್ರವೃತ್ತಿ',
    riskTrendSubtitle: 'ಪೂರ್ಣಗೊಂಡ ಇತ್ತೀಚಿನ ಪರೀಕ್ಷೆಗಳಲ್ಲಿನ ಬದಲಾವಣೆ.',
    latestRisk: 'ಇತ್ತೀಚಿನ ಅಪಾಯ',
    trend: 'ಪ್ರವೃತ್ತಿ',
    delta: 'ಬದಲಾವಣೆ',
    dataPoints: 'ಡೇಟಾ ಪಾಯಿಂಟ್‌ಗಳು',
    stable: 'ಸ್ಥಿರ',
    up: 'ಏರಿಕೆ',
    down: 'ಇಳಿಕೆ',
    notEnoughData: 'ಸಾಕಷ್ಟು ಡೇಟಾ ಇಲ್ಲ',
    notEnoughDataBody: 'ಕಾಲಕ್ರಮದಲ್ಲಿ ಅಪಾಯ ಬದಲಾವಣೆಯನ್ನು ನೋಡಲು ಕನಿಷ್ಠ 2 ಪರೀಕ್ಷೆಗಳು ಪೂರ್ಣಗೊಳಿಸಿ.',
    testTypeSeries: 'ಪರೀಕ್ಷೆ ವಿಧಗಳು',
    total: 'ಒಟ್ಟು',
    testTypeDistribution: 'ಪರೀಕ್ಷೆ ವಿಧ ವಿತರಣೆ',
    testTypeDistributionBody: 'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಉಳಿಸಿದ ಪರಿಶೀಲನೆಗಳಲ್ಲಿನ ಮಾಧ್ಯಮ ಸಮತೋಲನ.',
    noTestsTaken: 'ಯಾವುದೇ ಪರೀಕ್ಷೆಗಳು ತೆಗೆದುಕೊಳ್ಳಲಾಗಿಲ್ಲ',
    noTestsTakenBody: 'ನೀವು ಮೊದಲ ಪರೀಕ್ಷೆ ತೆಗೆದುಕೊಂಡ ಬಳಿಕ ನಿಮ್ಮ ವಿಶ್ಲೇಷಣಾ ಮಾಧ್ಯಮಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.',
    recentTests: 'ಇತ್ತೀಚಿನ ಪರೀಕ್ಷೆಗಳು',
    viewAll: 'ಎಲ್ಲವನ್ನೂ ನೋಡಿ',
    riskPrefix: 'ಅಪಾಯ',
    processing: 'ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿ...',
    noRecentTests: 'ನೀವು ಇನ್ನೂ ಯಾವುದೇ ಪರೀಕ್ಷೆ ಮಾಡಿಲ್ಲ.',
    testHistories: 'ಪರೀಕ್ಷಾ ಇತಿಹಾಸ ಮತ್ತು ವೈದ್ಯರ ಪ್ರತಿಕ್ರಿಯೆ',
    testHistoriesBody: 'ವೈದ್ಯರ ಟಿಪ್ಪಣಿಗಳು ಮತ್ತು ಶಿಫಾರಸುಗಳಿರುವ ಎಲ್ಲಾ ವಿಮರ್ಶಿತ ಪರೀಕ್ಷೆಗಳು',
    doctorFeedback: 'ವೈದ್ಯರ ಪ್ರತಿಕ್ರಿಯೆ:',
    viewFullReport: 'ಪೂರ್ಣ ವರದಿ ನೋಡಿ',
    noReviewedReports: 'ಇನ್ನೂ ವಿಮರ್ಶಿತ ವರದಿಗಳು ಇಲ್ಲ',
    noReviewedReportsBody: 'ನಿಮ್ಮ ವರದಿಯನ್ನು ವಿಮರ್ಶಿಸಿ ಪ್ರತಿಕ್ರಿಯೆ ಪಡೆಯಲು ವೈದ್ಯರ ಸಲಹೆ ಬುಕ್ ಮಾಡಿ',
    nutritionSummary: 'ಪೋಷಣ ಸಾರಾಂಶ',
    nutritionSummaryBody: 'ತ್ವರಿತ ಅವಲೋಕನ. ಸಂಪೂರ್ಣ ಆಹಾರ ಮಾರ್ಗದರ್ಶನ ಮತ್ತು ಟ್ರ್ಯಾಕಿಂಗ್‌ಗಾಗಿ Nutrition Planner ತೆರೆಯಿರಿ.',
    openPlanner: 'ಪ್ಲಾನರ್ ತೆರೆಯಿರಿ',
    latestBmi: 'ಇತ್ತೀಚಿನ BMI',
    nutritionScore: 'ಪೋಷಣ ಸ್ಕೋರ್',
    lastTrackedMealQuality: 'ಕೊನೆಯ ಟ್ರ್ಯಾಕ್ ಮಾಡಿದ ಊಟದ ಗುಣಮಟ್ಟ',
    hydration: 'ಜಲಾಂಶ',
    dailyIntakeSnapshot: 'ದೈನಂದಿನ ಆಹಾರ ಕ್ಷಣಚಿತ್ರ',
    profileSetup: 'ಪ್ರೊಫೈಲ್ ಸಿದ್ಧತೆ',
    completeDetailsInPlanner: 'ಪ್ಲಾನರ್‌ನಲ್ಲಿ ವಿವರಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ',
  },
} as const;

const modalityLabels = {
  spiral: { en: 'Spiral', kn: 'ಸ್ಪೈರಲ್' },
  wave: { en: 'Wave', kn: 'ಅಲೆ' },
  speech: { en: 'Voice', kn: 'ಧ್ವನಿ' },
  fusion: { en: 'Fusion', kn: 'ಫ್ಯೂಷನ್' },
  motor: { en: 'Motor', kn: 'ಚಲನ' },
  nutrition: { en: 'Nutrition', kn: 'ಪೋಷಣ' },
} as const;

const bmiClassLabels = {
  Underweight: { en: 'Underweight', kn: 'ಕಡಿಮೆ ತೂಕ' },
  Normal: { en: 'Normal', kn: 'ಸಾಮಾನ್ಯ' },
  Overweight: { en: 'Overweight', kn: 'ಅಧಿಕ ತೂಕ' },
  Obese: { en: 'Obese', kn: 'ಅತಿಯಾದ ತೂಕ' },
} as const;

const workflowStatusLabels = {
  pending: { en: 'Pending', kn: 'ಬಾಕಿ' },
  accepted: { en: 'Accepted', kn: 'ಸ್ವೀಕರಿಸಲಾಗಿದೆ' },
  completed: { en: 'Completed', kn: 'ಪೂರ್ಣಗೊಂಡಿದೆ' },
  rejected: { en: 'Rejected', kn: 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ' },
  cancelled: { en: 'Cancelled', kn: 'ರದ್ದಾಗಿದೆ' },
  scheduled: { en: 'Scheduled', kn: 'ನಿಗದಿಯಾಗಿದೆ' },
} as const;

const translateModality = (type: string, language: 'en' | 'kn') => modalityLabels[type as keyof typeof modalityLabels]?.[language] || type;
const translateBmiClass = (value: string, language: 'en' | 'kn') => bmiClassLabels[value as keyof typeof bmiClassLabels]?.[language] || value;
const translateWorkflowStatus = (value: string | null | undefined, language: 'en' | 'kn') => {
  if (!value) return language === 'kn' ? 'ಲಭ್ಯವಿಲ್ಲ' : 'N/A';
  return workflowStatusLabels[value.toLowerCase() as keyof typeof workflowStatusLabels]?.[language] || value;
};

const classifyBmi = (bmi: number) => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const calculateBmi = (weightKg: unknown, heightCm: unknown): number | null => {
  const weight = toNumberOrNull(weightKg);
  const height = toNumberOrNull(heightCm);

  if (weight === null || height === null || weight <= 0 || height <= 0) {
    return null;
  }

  const heightMeters = height / 100;
  return Number((weight / (heightMeters * heightMeters)).toFixed(1));
};

const toScore10 = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value > 1) return Math.max(0, Math.min(10, value));
  return Math.max(0, Math.min(10, value * 10));
};

const deriveRiskScore = (test: Test): number | null => {
  const result: any = test.result || {};

  // Preferred direct values
  const directRiskScore = toScore10(result?.riskScore);
  if (directRiskScore !== null) return directRiskScore;

  // Voice payload variants
  const probability = toScore10(result?.probability);
  if (probability !== null) return probability;

  const probabilityOfParkinsons = toScore10(result?.probabilityOfParkinsons);
  if (probabilityOfParkinsons !== null) return probabilityOfParkinsons;

  // Handwriting payload often has probabilities.Parkinsons
  const probabilityFromMap = toScore10(result?.probabilities?.Parkinsons);
  if (probabilityFromMap !== null) return probabilityFromMap;

  // Final fallback based on label + confidence
  if (typeof result?.confidence === 'number') {
    const confidence01 = Math.max(0, Math.min(1, result.confidence));
    if (result?.label === 'Parkinsons') return confidence01 * 10;
    if (result?.label === 'Healthy') return (1 - confidence01) * 10;
  }

  return null;
};

const getRiskSeries = (tests: Test[], locale = 'en-US') => tests
  .map((t) => {
    const score = deriveRiskScore(t);
    if (score === null) return null;
    return {
      date: new Date(t.created_at).toLocaleDateString(locale),
      score: Number(score.toFixed(1)),
      createdAt: new Date(t.created_at).getTime(),
    };
  })
  .filter((item): item is { date: string; score: number; createdAt: number } => Boolean(item))
  .sort((a, b) => a.createdAt - b.createdAt);

const getDistribution = (tests: Test[]) => tests.reduce((acc, test) => {
  acc[test.test_type] = (acc[test.test_type] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

const toIndicatorScore = (score: number | null, fallback: number) => {
  if (score === null) return fallback;
  return Math.max(0, Math.min(100, Math.round(score * 10)));
};

const getRiskScoreChartOption = (tests: Test[], riskSeriesLabel: string, locale = 'en-US') => {
  const chartData = getRiskSeries(tests, locale);

  if (chartData.length < 2) {
      return null; // Return null to indicate not enough data for a trend line
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderWidth: 0,
      textStyle: { color: '#F9FAFB' },
    },
    xAxis: {
      type: 'category',
      data: chartData.map(d => d.date),
      axisLine: { lineStyle: { color: '#9CA3AF' } },
      axisLabel: { color: '#6B7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 10,
      axisLine: { lineStyle: { color: '#9CA3AF' } },
      splitLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { color: '#6B7280', fontSize: 11 },
    },
    series: [{
      name: riskSeriesLabel,
      type: 'line',
      smooth: true,
      data: chartData.map(d => d.score),
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 3, color: '#5D7052' },
      itemStyle: { color: '#5D7052' }, // Moss Green
      areaStyle: {
          color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(93, 112, 82, 0.4)' }, { offset: 1, color: 'rgba(93, 112, 82, 0)' }]
          }
      }
    }],
    grid: { left: '6%', right: '4%', top: '10%', bottom: '10%', containLabel: true },
  };
};

const getDistributionChartOption = (tests: Test[], seriesLabel: string, totalLabel: string, language: 'en' | 'kn') => {
    const distribution = getDistribution(tests);

    return {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item' },
        legend: { show: false },
        series: [{
            name: seriesLabel,
            type: 'pie',
            radius: ['55%', '80%'],
            center: ['50%', '52%'],
            avoidLabelOverlap: true,
            label: { show: true, position: 'inner', formatter: '{c}', color: 'white', fontWeight: 'bold' },
            emphasis: {
                itemStyle: {
                   shadowBlur: 10,
                   shadowOffsetX: 0,
                   shadowColor: 'rgba(0, 0, 0, 0.2)'
                }
            },
            data: Object.entries(distribution).map(([name, value]) => ({ value, name: translateModality(name, language) })),
            color: ['#5D7052', '#C18C5D', '#A85448', '#4A4A40', '#78786C'] // Earthy palette
        }],
        graphic: [
          {
            type: 'text',
            left: 'center',
            top: '45%',
            style: {
              text: String(tests.length),
              fill: '#1F2937',
              fontSize: 26,
              fontWeight: 700,
              textAlign: 'center',
            },
          },
          {
            type: 'text',
            left: 'center',
            top: '54%',
            style: {
              text: totalLabel,
              fill: '#6B7280',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
            },
          },
        ],
    };
};

const readStoredArray = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}"`, error);
    return [];
  }
};

const getDashboardCacheKey = (userId: string) => `dashboard_cache_${userId}`;

const readDashboardCache = (userId?: string | null): { tests: Test[]; timestamp: number } | null => {
  try {
    const raw = userId
      ? (localStorage.getItem(getDashboardCacheKey(userId)) || localStorage.getItem('dashboard_cache'))
      : localStorage.getItem('dashboard_cache');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tests) || typeof parsed.timestamp !== 'number') {
      return null;
    }
    return {
      tests: parsed.tests as Test[],
      timestamp: parsed.timestamp,
    };
  } catch (error) {
    console.warn('Failed to parse dashboard cache', error);
    return null;
  }
};

const toDashboardCacheTests = (tests: Test[]): Test[] => tests.map((test) => {
  const result = (test.result && typeof test.result === 'object')
    ? { ...(test.result as Record<string, unknown>) }
    : test.result;

  if (result && typeof result === 'object') {
    delete (result as Record<string, unknown>).artifactDataUrl;
    delete (result as Record<string, unknown>).videoFrames;
    delete (result as Record<string, unknown>).analysisFrames;
  }

  return {
    ...test,
    raw_storage_path: typeof test.raw_storage_path === 'string' && test.raw_storage_path.startsWith('data:')
      ? null
      : test.raw_storage_path,
    result: result as Test['result'],
  };
});

const writeDashboardCache = (userId: string, tests: Test[]) => {
  const writePayload = (cacheTests: Test[]) => JSON.stringify({
    tests: toDashboardCacheTests(cacheTests),
    timestamp: Date.now(),
  });

  try {
    const fullPayload = writePayload(tests);
    localStorage.setItem(getDashboardCacheKey(userId), fullPayload);
    return;
  } catch (error) {
    console.warn('Dashboard cache full, retrying with a smaller cache', error);
  }

  try {
    const reducedPayload = writePayload(tests.slice(0, 20));
    localStorage.setItem(getDashboardCacheKey(userId), reducedPayload);
  } catch (error) {
    console.warn('Dashboard cache write skipped because storage quota is full', error);
  }
};

const mergeTestsLikeHistory = (localTests: Test[], mongodbTests: Test[]) => {
  const allTests = [...localTests, ...mongodbTests];
  const mergedById = new Map<string, any>();

  allTests.forEach((test: any, index) => {
    const key = test?.id || `${test?.patient_id}-${test?.test_type}-${test?.created_at}-${index}`;
    const existing = mergedById.get(key);
    if (!existing) {
      mergedById.set(key, test);
      return;
    }

    const existingResult = existing.result || {};
    const nextResult = test.result || {};
    mergedById.set(key, {
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

  return Array.from(mergedById.values())
    .filter((test) => test && test.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

const mergeTests = (localTests: Test[], mongodbTests: Test[]) => {
  const allTests = [...localTests, ...mongodbTests];
  return Array.from(
    new Map(
      allTests
        .filter((test) => test && test.created_at)
        .map((test, index) => [
          test.id || `${test.patient_id}-${test.test_type}-${test.created_at}-${index}`,
          test,
        ]),
    ).values(),
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

const Dashboard = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const copy = dashboardCopy[language];
  const locale = language === 'kn' ? 'kn-IN' : 'en-US';
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [stats, setStats] = useState({
    totalTests: 0,
    avgRisk: 'N/A',
    lastTestDate: 'N/A',
  });
  const [timeframe, setTimeframe] = useState<'all' | '30d' | '5'>('all');
  const [reports, setReports] = useState<UnifiedReport[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const testsRef = useRef<Test[]>([]);

  useEffect(() => {
    testsRef.current = tests;
  }, [tests]);

  const formatLastTestDate = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
    return diffDays === 0 ? copy.today : copy.daysAgo(diffDays);
  };

  const calculateStats = (testsData: Test[], tf: 'all' | '30d' | '5' = timeframe) => {
    if (!testsData || testsData.length === 0) {
        setStats({ totalTests: 0, avgRisk: copy.notAvailable, lastTestDate: copy.notAvailable });
        return;
    };

    const totalTests = testsData.length;
    
    const lastTestDate = new Date(testsData[0].created_at);
    const lastTestDateStr = formatLastTestDate(lastTestDate);

    let filteredTests = testsData;
    if (tf === '30d') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filteredTests = testsData.filter(t => new Date(t.created_at) >= thirtyDaysAgo);
    } else if (tf === '5') {
      filteredTests = testsData.slice(0, 5);
    }

    const testsWithRisk = filteredTests
      .map((t) => deriveRiskScore(t))
      .filter((score): score is number => score !== null);
      
    const avgRisk = testsWithRisk.length > 0 
        ? (testsWithRisk.reduce((acc, score) => acc + score, 0) / testsWithRisk.length).toFixed(1)
        : copy.notAvailable;
    
    setStats({ totalTests, avgRisk, lastTestDate: lastTestDateStr });
  };

  const fetchTests = async (silent = false) => {
    if (!user) {
        setLoading(false);
        setInitialLoadComplete(true);
        return;
    }

    // Only show spinner on initial load, not on refreshes
    if (!silent && !initialLoadComplete) {
        setLoading(true);
    }
    console.log('fetchTests - starting to fetch tests for user:', user.id);

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
          console.log('✅ Loaded tests from MongoDB:', mongodbTests.length);
        }
      } catch (dbError) {
        console.warn('⚠️ MongoDB not available, loading from localStorage');

      }

      // Load local tests (voice and others)
      const localTests = [
        ...readStoredArray<Test>('local_tests'),
        ...readStoredArray<Test>('local_test_results'),
      ].filter((t) => t?.patient_id === user.id);
      console.log('✅ Loaded tests from localStorage:', localTests.length);

      // Merge and deduplicate
      const uniqueTests = mergeTestsLikeHistory(localTests, mongodbTests as Test[]);

      const cachedTests = readDashboardCache(user.id)?.tests || [];
      const fallbackTests = testsRef.current.length ? testsRef.current : cachedTests;
      const testsToDisplay = uniqueTests.length === 0 && fallbackTests.length > 0
        ? fallbackTests
        : uniqueTests;

      setTests(testsToDisplay);
      calculateStats(testsToDisplay);
      
      // Cache data in localStorage for instant load next time
      if (testsToDisplay.length > 0) {
        writeDashboardCache(user.id, testsToDisplay);
      }
      
      console.log('📊 Total tests displayed:', uniqueTests.length);
    } catch (error) {
      console.error('Failed to fetch tests:', error);
      const fallbackTests = testsRef.current.length
        ? testsRef.current
        : (readDashboardCache(user.id)?.tests || []);
      setTests(fallbackTests);
      calculateStats(fallbackTests);
    } finally {
      console.log('fetchTests - setting loading to false');
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  const fetchWorkflowData = async () => {
    if (!user || user.role !== 'patient') {
      setReports([]);
      setAppointments([]);
      return;
    }

    try {
      const [reportData, appointmentData] = await Promise.all([
        getReports().catch(() => []),
        getAppointments().catch(() => []),
      ]);

      let localAppointments: AppointmentRecord[] = [];
      try {
        localAppointments = (JSON.parse(localStorage.getItem(LOCAL_APPOINTMENTS_KEY) || '[]') as AppointmentRecord[])
          .filter((appointment) => appointment.patient_id === user.id);
      } catch (error) {
        console.error('Failed to read local appointment cache:', error);
      }

      const byId = new Map<string, AppointmentRecord>();
      [...localAppointments, ...appointmentData].forEach((appointment) => {
        if (appointment?.id) {
          byId.set(appointment.id, appointment);
        }
      });

      const mergedAppointments = collapseAppointments(Array.from(byId.values()));

      setReports(reportData);
      setAppointments(mergedAppointments);
    } catch (error) {
      console.error('Failed to fetch patient workflow data:', error);
      setReports([]);
      setAppointments([]);
    }
  };

  useEffect(() => {
    const bootstrapReport = async () => {
      if (!user || user.role !== 'patient' || reports.length > 0) return;
      const latestFusionTest = tests.find((test) => test.test_type === 'fusion');
      if (!latestFusionTest) return;

      try {
        await ensureUnifiedReport({ testId: latestFusionTest.id });
        const refreshedReports = await getReports().catch(() => []);
        setReports(refreshedReports);
      } catch (error) {
        console.error('Failed to bootstrap unified report from fusion test:', error);
      }
    };

    bootstrapReport();
  }, [reports.length, tests, user]);

  useEffect(() => {
    calculateStats(tests, timeframe);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    console.log('Dashboard useEffect - authLoading:', authLoading, 'user:', user);
    
    if (authLoading) {
        return;
    }

    if (!user) {
        console.log('No user - setting loading to false');
        setTests([]);
        calculateStats([]);
        setLoading(false);
        return;
    }

    console.log('User exists - fetching data');
    
    let shouldUseSilentInitialFetch = false;

    // Load from cache immediately for instant display
    const cachedData = readDashboardCache(user.id);
    if (cachedData) {
        const { tests: cachedTests } = cachedData;
        if (cachedTests.length > 0) {
          console.log('📦 Loading from cache for instant display');
          setTests(cachedTests);
          calculateStats(cachedTests);
          setLoading(false);
          setInitialLoadComplete(true);
          shouldUseSilentInitialFetch = true;
        }
    }
    
    // Always continue with the normal refresh path even when cache was shown.
    fetchTests(shouldUseSilentInitialFetch);
    fetchWorkflowData();
    
    // Setup realtime subscriptions
    const channel = mongodb.channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tests', filter: `patient_id=eq.${user.id}`},
        (payload: unknown) => {
          console.log('Realtime change received!', payload);
          fetchTests();
        })
      .subscribe();

    // Poll localStorage for new tests every 5 seconds for real-time updates (silent)
    const pollInterval = setInterval(() => {
      console.log('🔄 Polling for new tests...');
      fetchTests(true); // Silent refresh
      fetchWorkflowData();
    }, 5000);

    // Listen for storage events from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'local_tests' || e.key === 'local_test_results') {
        console.log('📢 Storage change detected, refreshing tests...');
        fetchTests(true); // Silent refresh
      }
      if (e.key === LOCAL_APPOINTMENTS_KEY) {
        fetchWorkflowData();
      }
    };

    const handleWindowFocus = () => {
      fetchTests(true);
      fetchWorkflowData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
        mongodb.removeChannel(channel);
        clearInterval(pollInterval);
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('focus', handleWindowFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  if (authLoading || loading) {
    return <div className="flex h-full w-full items-center justify-center"><LoaderCircle className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center space-y-4 text-center">
        <h2 className="text-2xl font-semibold">{copy.signInTitle}</h2>
        <p className="text-muted-foreground max-w-md">
          {copy.signInBody}
        </p>
        <Link
          to="/login"
          className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground hover:scale-105 shadow-soft transition-all duration-300 active:scale-95"
        >
          {copy.goToSignIn}
        </Link>
      </div>
    );
  }

  const riskSeries = getRiskSeries(tests, locale);
  const latestRisk = riskSeries.length ? riskSeries[riskSeries.length - 1].score : null;
  const previousRisk = riskSeries.length > 1 ? riskSeries[riskSeries.length - 2].score : null;
  const riskDelta = latestRisk !== null && previousRisk !== null
    ? Number((latestRisk - previousRisk).toFixed(1))
    : null;
  const trendDirection = riskDelta === null ? copy.stable : riskDelta > 0 ? copy.up : riskDelta < 0 ? copy.down : copy.stable;
  const riskScoreChartOption = getRiskScoreChartOption(tests, copy.riskScoreSeries, locale);
  const distributionChartOption = getDistributionChartOption(tests, copy.testTypeSeries, copy.total, language);

  const distribution = getDistribution(tests);
  const latestReport = reports[0] || null;
  const nonRejectedAppointments = appointments.filter((appointment) => !isRejectedAppointment(appointment));
  const latestReportAppointment = latestReport
    ? nonRejectedAppointments.find((appointment) => appointment.report_id === latestReport.id)
    : null;
  const prescriptionAppointment = nonRejectedAppointments.find((appointment) => appointment.report?.prescription?.length);
  const upcomingAppointment = latestReportAppointment
    || prescriptionAppointment
    || [...nonRejectedAppointments]
      .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
      .find((appointment) => normalizeAppointmentStatus(appointment.status) !== 'completed')
    || nonRejectedAppointments[0]
    || null;
  const distributionEntries = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const distributionPalette = ['#5D7052', '#C18C5D', '#A85448', '#4A4A40', '#78786C'];
  const latestByModality = getLatestByModality(tests);
  const digitalTwinMetrics = {
    handTremor: toIndicatorScore(latestByModality.spiral ? deriveRiskScore(latestByModality.spiral) : null, 65),
    voiceStability: toIndicatorScore(latestByModality.speech ? deriveRiskScore(latestByModality.speech) : null, 50),
    drawingAccuracy: toIndicatorScore(latestByModality.wave ? deriveRiskScore(latestByModality.wave) : null, 70),
  };

  const nutritionProfile = (() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    } catch {
      return {};
    }
  })();

  const nutritionLogs = (() => {
    try {
      return JSON.parse(localStorage.getItem(LOGS_KEY) || '[]') as Array<{ score?: number; hydrationLiters?: number }>;
    } catch {
      return [];
    }
  })();

  const bmiHistory = (() => {
    try {
      return JSON.parse(localStorage.getItem(BMI_HISTORY_KEY) || '[]') as Array<{ bmi?: number }>;
    } catch {
      return [];
    }
  })();

  const resolvedNutritionProfile = {
    ...nutritionProfile,
    age: nutritionProfile?.age ?? profile?.age ?? null,
    weightKg: profile?.weightKg ?? nutritionProfile?.weightKg ?? null,
    heightCm: profile?.heightCm ?? nutritionProfile?.heightCm ?? null,
    bmi: typeof profile?.bmi === 'number' ? profile.bmi : nutritionProfile?.bmi ?? null,
    bmiClass: profile?.bmiClass || nutritionProfile?.bmiClass || null,
  };
  const latestBmi = typeof bmiHistory?.[0]?.bmi === 'number'
    ? bmiHistory[0].bmi
    : typeof resolvedNutritionProfile.bmi === 'number'
      ? resolvedNutritionProfile.bmi
      : calculateBmi(resolvedNutritionProfile.weightKg, resolvedNutritionProfile.heightCm);
  const latestBmiClass = latestBmi !== null
    ? translateBmiClass(resolvedNutritionProfile.bmiClass || classifyBmi(latestBmi), language)
    : copy.notAvailable;
  const latestNutritionScore = typeof nutritionLogs?.[0]?.score === 'number' ? nutritionLogs[0].score : null;
  const latestHydration = typeof nutritionLogs?.[0]?.hydrationLiters === 'number' ? nutritionLogs[0].hydrationLiters : null;
  const profileCompleteness = ['age', 'weightKg', 'heightCm', 'dietaryPreference']
    .filter((key) => Boolean((resolvedNutritionProfile as any)[key])).length;

  return (
    <div className="relative space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-organic-1 bg-background/70 dark:bg-accent/35">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{copy.totalTests}</p>
            <div className="p-2 bg-primary/10 rounded-2xl"><BarChart className="h-5 w-5 text-primary" /></div>
          </div>
          <p className="text-4xl font-serif font-bold mt-3 text-foreground">{stats.totalTests}</p>
        </Card>
        <Card className="rounded-organic-2 bg-background/70 dark:bg-accent/35">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{copy.averageRisk}</p>
            <div className="flex items-center gap-3">
              <select 
                value={timeframe} 
                onChange={(e) => {
                  const val = e.target.value as 'all' | '30d' | '5';
                  setTimeframe(val);
                  calculateStats(tests, val);
                }}
                className="text-[11px] font-semibold tracking-wider text-muted-foreground bg-background/50 border border-border/50 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-background transition-colors"
                title={copy.averageRiskTimeframe}
              >
                <option value="all">{copy.allTime}</option>
                <option value="30d">{copy.last30Days}</option>
                <option value="5">{copy.last5Tests}</option>
              </select>
              <div className="p-2 bg-secondary/10 rounded-2xl"><Activity className="h-5 w-5 text-secondary" /></div>
            </div>
          </div>
          <p className="text-4xl font-serif font-bold mt-3 text-secondary">{stats.avgRisk} <span className="text-xl text-muted-foreground font-sans">/ 10</span></p>
        </Card>
        <Card className="rounded-organic-3 bg-background/70 dark:bg-accent/35">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{copy.lastTest}</p>
            <div className="p-2 bg-accent-foreground/5 rounded-2xl"><FileText className="h-5 w-5 text-accent-foreground" /></div>
          </div>
          <p className="text-3xl font-serif font-bold mt-3 text-foreground">{stats.lastTestDate}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-organic-4 bg-background/70 dark:bg-accent/35">
          <div className="flex items-start justify-between gap-4 border-b border-border/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold text-foreground">{copy.latestUnifiedReport}</h3>
                <p className="text-sm text-muted-foreground">{copy.unifiedReportSubtitle}</p>
              </div>
            </div>
            <Link
              to="/comprehensive-screening"
              className="inline-flex items-center gap-2 rounded-full border border-border/40 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
            >
              {copy.updateAiReport}
            </Link>
          </div>
          {latestReport ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.status}</p>
                  <p className="text-xl font-serif font-bold text-foreground mt-1 capitalize">{translateWorkflowStatus(latestReport.status, language)}</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.aiRisk}</p>
                  <p className="text-xl font-serif font-bold text-foreground mt-1">{latestReport.aiResults?.summary?.riskScore?.toFixed?.(1) ?? copy.notAvailable} / 10</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.doctorNotes}</p>
                  <p className="text-xl font-serif font-bold text-foreground mt-1">{latestReport.doctorNotes ? copy.available : copy.pending}</p>
                </div>
              </div>
              {latestReport.prescription?.length > 0 && (
                <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.prescription}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {latestReport.prescription.map((item, index) => (
                      <span key={`${item}-${index}`} className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.summary}</p>
                <p className="text-sm text-foreground mt-2 leading-relaxed">
                  {latestReport.doctorNotes || latestReport.aiResults?.fusion?.recommendations?.[0] || copy.reportReadyFallback}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/reports/${latestReport.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {copy.viewReport}
                </Link>
                <Link
                  to="/consult"
                  className="inline-flex items-center gap-2 rounded-full border border-border/50 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  {copy.bookAppointment}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 text-center">
              <p className="font-serif text-xl font-bold text-foreground">{copy.noUnifiedReport}</p>
              <p className="text-sm text-muted-foreground mt-2">{copy.noUnifiedReportBody}</p>
              <Link
                to="/comprehensive-screening"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors mt-4"
              >
                {copy.createAiReport}
              </Link>
            </div>
          )}
        </Card>

        <Card className="rounded-organic-1 bg-background/70 dark:bg-accent/35">
          <div className="flex items-start justify-between gap-4 border-b border-border/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-secondary/10">
                <CalendarDays className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold text-foreground">{copy.appointmentsCalls}</h3>
                <p className="text-sm text-muted-foreground">{copy.appointmentsSubtitle}</p>
              </div>
            </div>
          </div>
          {upcomingAppointment ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.nextAppointment}</p>
                <p className="text-xl font-serif font-bold text-foreground mt-1">{upcomingAppointment.doctorDetails?.full_name || upcomingAppointment.doctor_name || copy.assignedDoctor}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {new Date(upcomingAppointment.appointment_date).toLocaleDateString(locale)} {language === 'kn' ? 'ರಂದು' : 'at'} {upcomingAppointment.appointment_time}
                </p>
                <p className="text-sm text-muted-foreground mt-1 capitalize">
                  {upcomingAppointment.consultation_type} {copy.consultation} • {translateWorkflowStatus(upcomingAppointment.status, language)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {upcomingAppointment.call_url && upcomingAppointment.status === 'accepted' && (
                  <a
                    href={upcomingAppointment.call_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Video className="h-4 w-4" /> {copy.joinCall}
                  </a>
                )}
                {upcomingAppointment.status === 'accepted' ? (
                  <Link
                    to={`/appointments/${upcomingAppointment.id}/communication`}
                    className="inline-flex items-center gap-2 rounded-full border border-border/50 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <MessageSquare className="h-4 w-4" /> {copy.chat}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/40 px-5 py-2.5 text-sm font-semibold text-muted-foreground">
                    <MessageSquare className="h-4 w-4" /> {copy.waitingForDoctor}
                  </span>
                )}
                {upcomingAppointment.report_id && (
                  <Link
                    to={`/reports/${upcomingAppointment.report_id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-border/50 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
                  >
                    {copy.openLinkedReport}
                  </Link>
                )}
                <Link
                  to="/consult"
                  className="inline-flex items-center gap-2 rounded-full border border-border/50 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  {copy.bookAppointment}
                </Link>
              </div>
              {upcomingAppointment.report?.prescription?.length ? (
                <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.latestPrescription}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {upcomingAppointment.report.prescription.map((item, index) => (
                      <span key={`${item}-${index}`} className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 text-center">
              <p className="font-serif text-xl font-bold text-foreground">{copy.noAppointments}</p>
              <p className="text-sm text-muted-foreground mt-2">{copy.noAppointmentsBody}</p>
              <Link
                to="/consult"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors mt-4"
              >
                {copy.bookAppointment}
              </Link>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 h-[28rem] rounded-organic-4 bg-background/70 dark:bg-accent/35">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="font-serif text-xl font-bold flex items-center text-foreground"><TrendingUp size={20} className="mr-2 text-primary" /> {copy.riskScoreTrend}</h3>
                <p className="text-sm text-muted-foreground font-medium mt-1">{copy.riskTrendSubtitle}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.latestRisk}</p>
                <p className="text-2xl font-serif font-bold text-primary">{latestRisk !== null ? `${latestRisk.toFixed(1)}/10` : copy.notAvailable}</p>
              </div>
            </div>
            {tests.length > 0 && riskScoreChartOption ? (
                <>
                  <div className="h-[18rem]">
                    <Chart option={riskScoreChartOption} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="rounded-2xl bg-background/60 border border-border/40 p-3 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{copy.trend}</p>
                      <p className="text-lg font-bold text-foreground">{trendDirection}</p>
                    </div>
                    <div className="rounded-2xl bg-background/60 border border-border/40 p-3 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{copy.delta}</p>
                      <p className="text-lg font-bold text-foreground">{riskDelta === null ? copy.notAvailable : `${riskDelta > 0 ? '+' : ''}${riskDelta.toFixed(1)}`}</p>
                    </div>
                    <div className="rounded-2xl bg-background/60 border border-border/40 p-3 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{copy.dataPoints}</p>
                      <p className="text-lg font-bold text-foreground">{riskSeries.length}</p>
                    </div>
                  </div>
                </>
            ) : (
                <div className="h-full w-full flex flex-col items-center justify-center -mt-8">
                    <div className="w-16 h-16 bg-muted/50 rounded-[2rem] flex items-center justify-center mb-4">
                        <TrendingUp size={28} className="text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-serif font-bold text-lg">{copy.notEnoughData}</p>
                    <p className="text-muted-foreground text-sm font-medium mt-1">{copy.notEnoughDataBody}</p>
                </div>
            )}
        </Card>
        <Card className="lg:col-span-2 h-[28rem] rounded-organic-1 bg-background/70 dark:bg-accent/35">
            <div className="mb-3">
              <h3 className="font-serif text-xl font-bold flex items-center text-foreground"><PieChart size={20} className="mr-2 text-primary" /> {copy.testTypeDistribution}</h3>
              <p className="text-sm text-muted-foreground font-medium mt-1">{copy.testTypeDistributionBody}</p>
            </div>
            {tests.length > 0 ? (
                <div className="h-[22rem] grid grid-cols-5 gap-2 items-center">
                  <div className="col-span-3 h-full">
                    <Chart option={distributionChartOption} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    {distributionEntries.map(([type, count], index) => {
                      const pct = Math.round((count / tests.length) * 100);
                      return (
                        <div key={type} className="rounded-xl border border-border/40 bg-background/60 p-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold capitalize text-foreground flex items-center gap-2">
                              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: distributionPalette[index % distributionPalette.length] }} />
                              {translateModality(type, language)}
                            </span>
                            <span className="font-semibold text-muted-foreground">{pct}%</span>
                          </div>
                          <p className="text-base font-bold text-foreground mt-0.5">{count}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
            ) : (
                <div className="h-full w-full flex flex-col items-center justify-center -mt-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-4">
                        <PieChart size={28} className="text-primary" />
                    </div>
                    <p className="text-foreground font-serif font-bold text-lg">{copy.noTestsTaken}</p>
                    <p className="text-muted-foreground text-sm font-medium mt-1 text-center px-4">{copy.noTestsTakenBody}</p>
                </div>
            )}
        </Card>
      </div>

      <DigitalTwinCard
        handTremor={digitalTwinMetrics.handTremor}
        voiceStability={digitalTwinMetrics.voiceStability}
        drawingAccuracy={digitalTwinMetrics.drawingAccuracy}
      />

      <Card className="rounded-organic-2 bg-background/70 dark:bg-accent/35">
        <div className="flex justify-between items-center mb-6 border-b border-border/30 pb-4">
            <h3 className="font-serif text-lg font-bold flex items-center text-foreground"><List size={18} className="mr-2 text-primary" /> {copy.recentTests}</h3>
            <Link to="/history" className="text-sm font-semibold text-primary/80 hover:text-primary transition-colors">{copy.viewAll}</Link>
        </div>
        <div className="space-y-3">
          {tests.slice(0, 3).map((item, index) => {
            const itemRiskScore = deriveRiskScore(item);
            return (
            <div key={`${item.id}-${index}`} className="flex items-center justify-between p-4 bg-background/50 backdrop-blur-sm border border-border/30 rounded-2xl hover:bg-muted/30 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary/5 rounded-xl"><FileText className="h-5 w-5 text-primary" /></div>
                <div>
                  <div className="font-serif font-bold text-foreground capitalize">{translateModality(item.test_type, language)} {language === 'kn' ? 'ಪರೀಕ್ಷೆ' : 'Test'}</div>
                  <div className="text-xs text-muted-foreground font-medium">{new Date(item.created_at).toLocaleDateString(locale)}</div>
                </div>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-4 py-1.5 rounded-full uppercase tracking-wide">
                {itemRiskScore !== null ? `${copy.riskPrefix}: ${itemRiskScore.toFixed(1)}/10` : copy.processing}
              </span>
            </div>
          )})}
          {tests.length === 0 && <p className="text-center text-muted-foreground py-8">{copy.noRecentTests}</p>}
        </div>
      </Card>

      <Card className="rounded-organic-1 bg-background/70 dark:bg-accent/35">
        <div className="flex justify-between items-center mb-6 border-b border-border/30 pb-4">
            <div>
              <h3 className="font-serif text-lg font-bold flex items-center text-foreground"><ClipboardList size={18} className="mr-2 text-secondary" /> {copy.testHistories}</h3>
              <p className="text-sm text-muted-foreground mt-1">{copy.testHistoriesBody}</p>
            </div>
        </div>
        <div className="space-y-3">
          {reports.map((report, index) => (
            <div key={`${report.id}-${index}`} className="rounded-2xl border border-border/30 bg-background/50 p-4 hover:bg-muted/20 transition-all duration-300">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-grow space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">{translateWorkflowStatus(report.status, language)}</span>
                    <p className="text-sm text-muted-foreground">{new Date(report.created_at).toLocaleDateString(locale)}</p>
                  </div>
                  {report.aiResults?.fusion?.summary && (
                    <p className="text-sm text-foreground font-medium">{report.aiResults.fusion.summary}</p>
                  )}
                  {report.doctorNotes && (
                    <div className="mt-2 p-3 rounded-xl bg-secondary/5 border border-secondary/20">
                      <p className="text-xs font-bold text-secondary mb-1">{copy.doctorFeedback}</p>
                      <p className="text-sm text-foreground">{report.doctorNotes}</p>
                    </div>
                  )}
                  {report.prescription?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {report.prescription.map((item, idx) => (
                        <span key={`${report.id}-rx-${idx}`} className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Link
                  to={`/reports/${report.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  {copy.viewFullReport}
                </Link>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <p className="font-medium">{copy.noReviewedReports}</p>
              <p className="text-sm mt-1">{copy.noReviewedReportsBody}</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-organic-1 bg-background/70 dark:bg-accent/35">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5 border-b border-border/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/15">
              <HeartPulse className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold text-foreground">{copy.nutritionSummary}</h3>
              <p className="text-sm text-muted-foreground">{copy.nutritionSummaryBody}</p>
            </div>
          </div>
          <Link
            to="/nutrition-planner"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            {copy.openPlanner} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/40 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.latestBmi}</p>
            <p className="text-2xl font-serif font-bold text-foreground mt-1">{latestBmi !== null ? latestBmi.toFixed(1) : copy.notAvailable}</p>
            <p className="text-xs text-muted-foreground mt-1">{latestBmiClass}</p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.nutritionScore}</p>
            <p className="text-2xl font-serif font-bold text-foreground mt-1">{latestNutritionScore !== null ? `${latestNutritionScore}/100` : copy.notAvailable}</p>
            <p className="text-xs text-muted-foreground mt-1">{copy.lastTrackedMealQuality}</p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><Droplets className="h-3.5 w-3.5" /> {copy.hydration}</p>
            <p className="text-2xl font-serif font-bold text-foreground mt-1">{latestHydration !== null ? `${latestHydration}L` : copy.notAvailable}</p>
            <p className="text-xs text-muted-foreground mt-1">{copy.dailyIntakeSnapshot}</p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.profileSetup}</p>
            <p className="text-2xl font-serif font-bold text-foreground mt-1">{profileCompleteness}/4</p>
            <p className="text-xs text-muted-foreground mt-1">{copy.completeDetailsInPlanner}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
