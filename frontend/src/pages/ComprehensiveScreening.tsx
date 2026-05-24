import { useEffect, useState, useCallback, useRef } from 'react';
import Card from '../components/Card';
import Chart from '../components/Chart';
import { mongodb } from '../lib/mongodbClient';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Test } from '../types/database';
import { useLanguage } from '../context/LanguageContext';
import {
  LoaderCircle,
  Layers,
  PenTool,
  Mic,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Save,
  RefreshCw,
  Info,
  TrendingUp,
  Download,
} from 'lucide-react';
import {
  getLatestByModality,
  computeFusionScore,
  getModalityDisplayName,
  getModalityModelName,
  type FusionResult,
  type ModalityResult,
} from '../services/fusionScoreService';
import { TEST_QUERY_TIMEOUT_MS, insertTestRecord } from '../services/testPersistence';
import { ensureUnifiedReport } from '../services/healthcareApi';
import { getLocale, translateModality, translateRiskLevel, translateSummaryLabel } from '../utils/localization';

/* â”€â”€â”€ PDF Export utility â”€â”€â”€ */
const exportToPDF = async (fusion: FusionResult, userName: string, userId: string) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  // Fetch Vitals (BMI etc)
  let nutrition: any = null;
  let patientProfile: any = null;
  try {
    // 1. Get official clinical profile
    const profileRes = await (mongodb as any)
      .from('patient_profiles')
      .select('*')
      .eq('id', userId) // fallback to a known ID
      .single();
    if (profileRes?.data) patientProfile = profileRes.data;

    // 2. Get latest nutrition for BMI
    const { data, error } = await (mongodb as any)
      .from('tests')
      .select('*')
      .eq('patient_id', userId)
      .eq('test_type', 'nutrition')
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data) && data.length > 0) {
      nutrition = (data[0]?.result as any)?.nutrition || null;
    }
  } catch (e) { console.error("Error fetching vitals for report:", e); }

  const profile = patientProfile || nutrition?.profile || {};
  const riskColor = fusion.riskLevel === 'High' ? '#dc2626' : fusion.riskLevel === 'Medium' ? '#d97706' : '#16a34a';

  const modalityRows = fusion.breakdown.map(b => `
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#334155;">${getModalityDisplayName(b.modality)}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:${b.score >= 7 ? '#dc2626' : b.score >= 4 ? '#d97706' : '#16a34a'}">${b.score.toFixed(1)} / 10</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;text-align:center;color:#64748b;">${(b.weight * 100).toFixed(0)}%</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#1e40af;">${b.weightedContribution.toFixed(2)}</td>
    </tr>
  `).join('');

  const modalityDetails = fusion.modalitiesUsed.map(m => `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4 style="margin:0;font-size:12px;color:#1e293b;font-weight:700;">${getModalityDisplayName(m.testType)} Analysis</h4>
          <p style="margin:1px 0 0;font-size:10px;color:#64748b;">Model: ${getModalityModelName(m.testType)}</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:800;color:${m.label === 'Parkinsons' ? '#dc2626' : '#16a34a'}">${m.riskScore.toFixed(1)}<span style="font-size:9px;color:#94a3b8;font-weight:400;">/10</span></div>
          <span style="font-size:8px;padding:1px 5px;border-radius:8px;font-weight:800;text-transform:uppercase;background:${m.label === 'Parkinsons' ? '#fef2f2' : '#f0fdf4'};color:${m.label === 'Parkinsons' ? '#dc2626' : '#16a34a'}">${m.label}</span>
        </div>
      </div>
    </div>
  `).join('');

  const recsHtml = fusion.recommendations.slice(0, 4).map((r, i) => `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;">
      <span style="min-width:18px;height:18px;background:#dbeafe;color:#1e40af;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;">${i + 1}</span>
      <span style="font-size:11px;color:#334155;line-height:1.4;">${r}</span>
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Clinical Evaluation Report - Fusion Analysis</title>
  <style>
    @media print { 
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
      @page { margin: 0.5cm; }
    }
    body { font-family: 'Inter', -apple-system, sans-serif; margin: 0; padding: 0; background: #fff; color: #0f172a; line-height: 1.3; }
    .page { max-width: 800px; margin: 0 auto; }
    .header { background: #1c3a61; color: white; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
    .content { padding: 20px 32px; }
    .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 16px 0 10px; }
    .vitals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 30px; margin-bottom: 12px; }
    .vital-item { display: flex; justify-content: space-between; font-size: 11px; }
    .vital-label { color: #64748b; font-weight: 600; }
    .vital-value { color: #0f172a; font-weight: 700; }
    .severity-bar { height: 6px; border-radius: 3px; display: flex; overflow: hidden; margin: 8px 0; position: relative; }
    .marker { position: absolute; top: -3px; width: 2px; height: 12px; background: #000; z-index: 10; transform: translateX(-50%); }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <h1 style="margin:0;font-size:16px;letter-spacing:-0.02em;">CLINICAL EVALUATION REPORT</h1>
      <p style="margin:1px 0 0;font-size:9px;opacity:0.8;">Neurology AI Assessment &bull; NeuroCare</p>
    </div>
    <div style="text-align:right;">
      <h2 style="margin:0;font-size:14px;">NeuroCare</h2>
      <p style="margin:1px 0 0;font-size:8px;opacity:0.8;">Integrated Platform</p>
    </div>
  </div>

  <div class="content">
    <div class="section-title">Patient Profile & Vitals</div>
    <div class="vitals-grid">
      <div class="vital-item"><span class="vital-label">Patient Name:</span> <span class="vital-value">${userName}</span></div>
      <div class="vital-item"><span class="vital-label">Date of Test:</span> <span class="vital-value">${dateStr}</span></div>
      <div class="vital-item"><span class="vital-label">Age / Gender:</span> <span class="vital-value">${profile.age || 'N/A'} Yrs / ${profile.gender || 'N/A'}</span></div>
      <div class="vital-item"><span class="vital-label">Modality:</span> <span class="vital-value" style="color:#1e40af;">FUSION ASSESSMENT</span></div>
      <div class="vital-item"><span class="vital-label">Weight:</span> <span class="vital-value">${profile.weightKg ? profile.weightKg + ' kg' : 'N/A'}</span></div>
      <div class="vital-item"><span class="vital-label">Height:</span> <span class="vital-value">${profile.heightCm ? profile.heightCm + ' cm' : 'N/A'}</span></div>
      <div class="vital-item"><span class="vital-label">BMI:</span> <span class="vital-value">${typeof profile?.bmi === 'number' ? `${profile.bmi.toFixed(1)} (${profile.bmiClass || 'N/A'})` : typeof nutrition?.bmi === 'number' ? `${nutrition.bmi.toFixed(1)} (${nutrition.bmiClass})` : 'N/A'}</span></div>
      <div class="vital-item"><span class="vital-label">Clinical Stage:</span> <span class="vital-value" style="color:#1e40af;">${profile.stage || 'N/A'}</span></div>
    </div>

    <div class="section-title">Diagnostic Summary</div>
    <div style="display:flex;background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:12px;gap:30px;align-items:center;">
      <div style="flex:1;">
        <p style="margin:0;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Overall Fusion Risk</p>
        <div style="font-size:32px;font-weight:800;color:${riskColor};margin:2px 0;">${fusion.fusionScore.toFixed(1)}<span style="font-size:14px;color:#94a3b8;font-weight:400;"> / 10</span></div>
        <div style="display:inline-block;padding:3px 10px;border-radius:15px;font-size:10px;font-weight:800;text-transform:uppercase;background:${riskColor}15;color:${riskColor};border:1px solid ${riskColor}30;">${fusion.riskLevel} SEVERITY</div>
      </div>
      <div style="flex:1.2;text-align:right;">
         <p style="margin:0;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Classification</p>
         <div style="font-size:20px;font-weight:800;color:#1e293b;margin:4px 0;">${fusion.riskLevel === 'Low' ? 'HEALTHY CONTROL' : 'PD DETECTED'}</div>
         <p style="margin:0;font-size:10px;color:#64748b;">AI Confidence: <strong>${(fusion.confidence * 100).toFixed(1)}%</strong></p>
      </div>
    </div>

    <div style="margin-bottom:20px;">
       <div class="severity-bar">
         <div style="width:35%;background:#16a34a;"></div>
         <div style="width:35%;background:#d97706;"></div>
         <div style="width:30%;background:#dc2626;"></div>
         <div class="marker" style="left:${fusion.fusionScore * 10}%;"></div>
       </div>
       <div style="display:flex;justify-content:space-between;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-top:2px;">
         <span>Healthy</span>
         <span>Moderate Risk</span>
         <span>High Risk</span>
       </div>
    </div>

    <div style="margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:11px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 14px;text-align:left;color:#475569;text-transform:uppercase;font-weight:700;">Modality</th>
            <th style="padding:8px 14px;text-align:center;color:#475569;text-transform:uppercase;font-weight:700;">Score</th>
            <th style="padding:8px 14px;text-align:center;color:#475569;text-transform:uppercase;font-weight:700;">Weight</th>
            <th style="padding:8px 14px;text-align:center;color:#475569;text-transform:uppercase;font-weight:700;">Impact</th>
          </tr>
        </thead>
        <tbody>${modalityRows}</tbody>
      </table>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${modalityDetails}
    </div>

    <div class="section-title">Physician Recommendations</div>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px;margin-bottom:20px;">
      ${recsHtml}
    </div>

    <div style="margin-top:30px;display:flex;justify-content:space-between;align-items:flex-end;font-size:10px;">
      <div style="width:200px;border-top:1px solid #0f172a;padding-top:5px;">
        <p style="margin:0;font-weight:800;text-transform:uppercase;">Assessment Signature</p>
      </div>
      <div style="width:120px;border-top:1.5px solid #0f172a;padding-top:5px;text-align:right;">
        <p style="margin:0;font-weight:800;text-transform:uppercase;">Date</p>
      </div>
    </div>

    <p style="margin-top:30px;font-size:9px;color:#94a3b8;text-align:center;font-style:italic;">
      This AI report is for screening assistance only. NeuroCare Platform Assessment.
    </p>
  </div>
</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 800);
  }
};

const screeningCopy = {
  en: {
    signInTitle: 'Sign in to access Comprehensive Screening',
    goToSignIn: 'Go to Sign In',
    title: 'Comprehensive Screening',
    subtitle: 'Multi-Modal Fusion Score',
    description: 'Combines results from spiral drawing, wave drawing, and voice analysis into a single unified risk score.',
    reportTitle: 'Fusion Screening Report',
    modalitiesGenerated: (count: number, date: string) => `${count} of 3 modalities · Generated ${date}`,
    saved: 'Saved!',
    saving: 'Saving...',
    saveReport: 'Save Report',
    exportPdf: 'Export PDF',
    overallConfidence: (value: string) => `${value}% overall AI confidence`,
    modalityComparison: 'Modality Comparison',
    scoreBreakdownChart: 'Score Breakdown Chart',
    weight: 'Weight',
    insufficientDataTitle: 'Insufficient Built Data',
    insufficientDataBody: (count: number) => `A multi-modal fusion score requires at least 2 of 3 test modalities. You currently have ${count} completed.`,
    takeTest: 'Take a Test',
    individualResults: 'Individual Test Results',
    recommendations: 'Recommendations',
    medicalDisclaimer: 'Medical Disclaimer',
    disclaimerBody: 'This multi-modal fusion score is an AI-assisted screening tool and is not a medical diagnosis. Always consult a qualified neurologist for clinical evaluation.',
    riskSuffix: 'Risk',
    confidence: 'Confidence',
    retake: 'Retake',
    notCompleted: 'Not yet completed',
    scoreSeries: 'Risk Score',
    score: 'Score',
    contribution: 'Contribution',
    failedSave: 'Failed to save report.',
  },
  kn: {
    signInTitle: 'ಸಮಗ್ರ ಪರೀಕ್ಷೆಯನ್ನು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ',
    goToSignIn: 'ಸೈನ್ ಇನ್‌ಗೆ ಹೋಗಿ',
    title: 'ಸಮಗ್ರ ಪರೀಕ್ಷೆ',
    subtitle: 'ಬಹು-ಮಾಧ್ಯಮ ಫ್ಯೂಷನ್ ಸ್ಕೋರ್',
    description: 'ಸ್ಪೈರಲ್ ಚಿತ್ರಣ, ಅಲೆ ಚಿತ್ರಣ ಮತ್ತು ಧ್ವನಿ ವಿಶ್ಲೇಷಣೆಯ ಫಲಿತಾಂಶಗಳನ್ನು ಒಂದು ಏಕೀಕೃತ ಅಪಾಯ ಸ್ಕೋರ್ ಆಗಿ ಸೇರಿಸುತ್ತದೆ.',
    reportTitle: 'ಫ್ಯೂಷನ್ ಪರೀಕ್ಷಾ ವರದಿ',
    modalitiesGenerated: (count: number, date: string) => `3ರಲ್ಲಿ ${count} ಮಾಧ್ಯಮಗಳು · ${date} ರಂದು ರಚಿಸಲಾಗಿದೆ`,
    saved: 'ಉಳಿಸಲಾಗಿದೆ!',
    saving: 'ಉಳಿಸಲಾಗುತ್ತಿದೆ...',
    saveReport: 'ವರದಿ ಉಳಿಸಿ',
    exportPdf: 'PDF ಎಕ್ಸ್‌ಪೋರ್ಟ್ ಮಾಡಿ',
    overallConfidence: (value: string) => `ಒಟ್ಟು ಎಐ ವಿಶ್ವಾಸ ${value}%`,
    modalityComparison: 'ಮಾಧ್ಯಮ ಹೋಲಿಕೆ',
    scoreBreakdownChart: 'ಸ್ಕೋರ್ ವಿಭಾಗ ಚಾರ್ಟ್',
    weight: 'ತೂಕ',
    insufficientDataTitle: 'ಸಾಕಷ್ಟು ಡೇಟಾ ಇಲ್ಲ',
    insufficientDataBody: (count: number) => `ಬಹು-ಮಾಧ್ಯಮ ಫ್ಯೂಷನ್ ಸ್ಕೋರ್‌ಗೆ ಕನಿಷ್ಠ 3ರಲ್ಲಿ 2 ಪರೀಕ್ಷಾ ಮಾಧ್ಯಮಗಳು ಬೇಕು. ಈಗ ನಿಮ್ಮ ಬಳಿ ${count} ಪೂರ್ಣಗೊಂಡಿವೆ.`,
    takeTest: 'ಪರೀಕ್ಷೆ ಮಾಡಿ',
    individualResults: 'ವೈಯಕ್ತಿಕ ಪರೀಕ್ಷಾ ಫಲಿತಾಂಶಗಳು',
    recommendations: 'ಶಿಫಾರಸುಗಳು',
    medicalDisclaimer: 'ವೈದ್ಯಕೀಯ ಸೂಚನೆ',
    disclaimerBody: 'ಈ ಬಹು-ಮಾಧ್ಯಮ ಫ್ಯೂಷನ್ ಸ್ಕೋರ್ ಎಐ ನೆರವಿನ ಪರೀಕ್ಷಾ ಸಾಧನ ಮಾತ್ರ; ಇದು ವೈದ್ಯಕೀಯ ನಿರ್ಣಯವಲ್ಲ. ಕ್ಲಿನಿಕಲ್ ಮೌಲ್ಯಮಾಪನಕ್ಕಾಗಿ ಅರ್ಹ ನ್ಯೂರಾಲಜಿಸ್ಟ್‌ರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
    riskSuffix: 'ಅಪಾಯ',
    confidence: 'ವಿಶ್ವಾಸ',
    retake: 'ಮತ್ತೆ ಮಾಡಿ',
    notCompleted: 'ಇನ್ನೂ ಪೂರ್ಣವಾಗಿಲ್ಲ',
    scoreSeries: 'ಅಪಾಯ ಸ್ಕೋರ್',
    score: 'ಸ್ಕೋರ್',
    contribution: 'ಕೊಡುಗೆ',
    failedSave: 'ವರದಿಯನ್ನು ಉಳಿಸಲು ವಿಫಲವಾಗಿದೆ.',
  },
} as const;

/* â”€â”€â”€ Animated circular gauge â”€â”€â”€ */
const FusionGauge = ({ score, riskLevel, label }: { score: number; riskLevel: string; label: string }) => {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / 10, 1);
  const offset = circumference * (1 - pct);

  const colorMap: Record<string, string> = { Low: '#5D7052', Medium: '#C18C5D', High: '#A85448' };
  const bgColorMap: Record<string, string> = { Low: 'rgba(93,112,82,0.12)', Medium: 'rgba(193,140,93,0.12)', High: 'rgba(168,84,72,0.12)' };
  const color = colorMap[riskLevel] || '#5D7052';
  const bgColor = bgColorMap[riskLevel] || 'rgba(93,112,82,0.12)';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 200, height: 200 }}>
        <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="#DED8CF" strokeWidth="12" />
          <motion.circle cx="100" cy="100" r={radius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5, ease: 'easeOut' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className="text-6xl font-serif font-bold" style={{ color }} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.5 }}>
            {score.toFixed(1)}
          </motion.span>
          <span className="text-sm text-muted-foreground font-medium">/ 10</span>
        </div>
      </div>
      <motion.div className="mt-3 px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: bgColor, color }}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.4 }}>
        {label}
      </motion.div>
    </div>
  );
};

/* â”€â”€â”€ Modality result card â”€â”€â”€ */
const ModalityCard = ({ result, index }: { result: ModalityResult; index: number }) => {
  const { language } = useLanguage();
  const copy = screeningCopy[language];
  const locale = getLocale(language);
  const iconMap: Record<string, any> = { spiral: PenTool, wave: PenTool, speech: Mic };
  const Icon = iconMap[result.testType] || PenTool;
  const isPd = result.label === 'Parkinsons';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * index, duration: 0.4 }}>
      <Card className={`relative overflow-hidden group hover:shadow-float transition-all duration-500 rounded-organic-${(index % 4) + 1} bg-white/70`}>
        <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-[0.05] transition-opacity group-hover:opacity-20" style={{ backgroundColor: isPd ? '#A85448' : '#5D7052' }} />
        <div className="flex items-start gap-4">
          <div className={`p-4 rounded-[1.5rem] ${isPd ? 'bg-destructive/10' : 'bg-primary/10'}`}>
            <Icon className={`h-6 w-6 ${isPd ? 'text-destructive' : 'text-primary'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-serif font-bold text-foreground text-xl">{translateModality(result.testType, language)}</h4>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{getModalityModelName(result.testType)}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className={`text-3xl font-serif font-bold ${isPd ? 'text-destructive' : 'text-primary'}`}>
                {result.riskScore.toFixed(1)}<span className="text-sm font-sans font-normal text-muted-foreground">/10</span>
              </span>
              <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide border ${isPd ? 'bg-destructive/5 text-destructive border-destructive/20' : 'bg-primary/5 text-primary border-primary/20'}`}>
                {translateSummaryLabel(result.label, language)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground font-medium">
                {copy.confidence}: {(result.confidence * 100).toFixed(1)}% &middot; {new Date(result.timestamp).toLocaleDateString(locale)}
              </p>
              <Link to="/new-test" className="text-xs font-bold text-primary hover:text-primary-foreground bg-primary/10 hover:bg-primary px-3 py-1 pb-1.5 rounded-full transition-colors">
                {copy.retake}
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

/* â”€â”€â”€ Missing modality card â”€â”€â”€ */
const MissingModalityCard = ({ type, index }: { type: 'spiral' | 'wave' | 'speech'; index: number }) => {
  const { language } = useLanguage();
  const copy = screeningCopy[language];
  const iconMap: Record<string, any> = { spiral: PenTool, wave: PenTool, speech: Mic };
  const Icon = iconMap[type] || PenTool;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * index, duration: 0.4 }}>
      <Card className={`border-dashed border-2 border-border/60 bg-white/40 hover:border-primary/50 hover:bg-white/70 transition-all rounded-organic-${(index % 4) + 1}`}>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-[1.5rem] bg-muted/50"><Icon className="h-6 w-6 text-muted-foreground" /></div>
          <div className="flex-1">
            <h4 className="font-serif font-bold text-foreground text-lg">{translateModality(type, language)}</h4>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{copy.notCompleted}</p>
          </div>
          <Link to="/new-test" className="flex items-center gap-2 text-sm font-bold text-primary group hover:text-primary-foreground bg-primary/10 hover:bg-primary px-5 py-2.5 rounded-full transition-all">
            {copy.takeTest} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </Card>
    </motion.div>
  );
};

/* â”€â”€â”€ Radar chart â”€â”€â”€ */
const getRadarOption = (fusion: FusionResult, language: 'en' | 'kn', seriesLabel: string) => ({
  backgroundColor: 'transparent',
  tooltip: {},
  radar: {
    indicator: fusion.breakdown.map(b => ({ name: translateModality(b.modality, language), max: 10 })),
    shape: 'polygon',
    splitNumber: 5,
    axisName: { color: '#374151', fontSize: 12, fontWeight: 600 },
    splitArea: { areaStyle: { color: ['rgba(93,112,82,0.03)', 'rgba(93,112,82,0.06)', 'rgba(93,112,82,0.09)', 'rgba(93,112,82,0.12)', 'rgba(93,112,82,0.15)'] } },
    splitLine: { lineStyle: { color: '#DED8CF' } },
    axisLine: { lineStyle: { color: '#DED8CF' } },
  },
  series: [{ type: 'radar', data: [{ value: fusion.breakdown.map(b => b.score), name: seriesLabel, areaStyle: { color: 'rgba(93,112,82,0.2)' }, lineStyle: { color: '#5D7052', width: 2 }, itemStyle: { color: '#5D7052' } }] }],
});

/* â”€â”€â”€ Breakdown bar chart â”€â”€â”€ */
const getBreakdownOption = (fusion: FusionResult, language: 'en' | 'kn', copy: typeof screeningCopy.en) => {
  const labels = fusion.breakdown.map(b => translateModality(b.modality, language));
  const scores = fusion.breakdown.map(b => b.score);
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0;
        const w = Number((fusion.breakdown[idx].weight * 100).toFixed(0));
        return `${labels[idx]}<br/>${copy.score}: ${scores[idx]}/10<br/>${copy.weight}: ${w}%<br/>${copy.contribution}: ${(scores[idx] * w / 100).toFixed(2)}`;
      },
    },
    xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: '#9CA3AF' } }, axisLabel: { fontSize: 11, fontWeight: 600, color: '#374151' } },
    yAxis: { type: 'value', min: 0, max: 10, axisLine: { lineStyle: { color: '#9CA3AF' } }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: copy.scoreSeries, type: 'bar', barWidth: '40%',
      data: scores.map(s => ({ value: s, itemStyle: { color: s >= 7 ? '#A85448' : s >= 4 ? '#C18C5D' : '#5D7052', borderRadius: [12, 12, 0, 0] } })),
      label: { show: true, position: 'top', formatter: (p: any) => `${p.value}/10`, fontSize: 13, fontWeight: 700, fontFamily: 'Nunito', color: '#2C2C24' },
    }],
    grid: { left: '10%', right: '10%', bottom: '12%', top: '12%' },
  };
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN PAGE
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export default function ComprehensiveScreening() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const copy = screeningCopy[language];
  const locale = getLocale(language);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [fusion, setFusion] = useState<FusionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchTests = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      let mongodbTests: any[] = [];
      try {
        const queryPromise = mongodb.from('tests').select('*').eq('patient_id', user.id).order('created_at', { ascending: false });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TEST_QUERY_TIMEOUT_MS));
        const { data, error: dbErr } = (await Promise.race([queryPromise, timeoutPromise])) as any;
        if (!dbErr && data) mongodbTests = data;
      } catch { /* MongoDB unavailable - fall through to localStorage */ }

      const localTests = [
        ...JSON.parse(localStorage.getItem('local_tests') || '[]'),
        ...JSON.parse(localStorage.getItem('local_test_results') || '[]'),
      ].filter((t: any) => t.patient_id === user.id);

      const allTests = [...localTests, ...mongodbTests];
      const unique = Array.from(new Map(allTests.map(t => [t.id, t])).values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTests(unique);
    } catch { setTests([]); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (tests.length === 0) { setFusion(null); return; }
    const latest = getLatestByModality(tests);
    setFusion(computeFusionScore(latest));
  }, [tests]);

  useEffect(() => {
    if (!authLoading && user) fetchTests();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, fetchTests]);

  const handleSave = useCallback(async () => {
    if (!fusion || !user) return;
    setSaving(true); setError(null);
    try {
      let savedTestId: string | null = null;
      const rec = {
        patient_id: user.id, test_type: 'fusion',
        raw_storage_path: null, status: 'completed', created_at: new Date().toISOString(),
        result: {
          label: fusion.riskLevel === 'Low' ? 'Healthy' : 'Parkinsons',
          riskScore: fusion.fusionScore, riskLevel: fusion.riskLevel, confidence: fusion.confidence,
          breakdown: fusion.breakdown, modalitiesUsed: fusion.modalitiesUsed.map(m => m.testType),
          missingModalities: fusion.missingModalities, recommendations: fusion.recommendations,
        },
        confidence: fusion.confidence,
        model_versions: { fusion: 'weighted-ensemble-v1', modalities: fusion.modalitiesUsed.map(m => `${m.testType}:${getModalityModelName(m.testType)}`) },
      };
      try {
        const { id, error: insErr } = await insertTestRecord(rec as Record<string, unknown>);
        if (!id) throw new Error(insErr || 'Database error');
        savedTestId = id;
      } catch {
        const l = JSON.parse(localStorage.getItem('local_tests') || '[]');
        const localId = `fusion-local-${Date.now()}`;
        l.unshift({ ...rec, id: localId });
        localStorage.setItem('local_tests', JSON.stringify(l));
        savedTestId = localId;
      }

      if (savedTestId && !savedTestId.startsWith('fusion-local-')) {
        try {
          await ensureUnifiedReport({ testId: savedTestId });
        } catch (reportError) {
          console.error('Failed to ensure unified report:', reportError);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message || copy.failedSave); }
    finally { setSaving(false); }
  }, [copy.failedSave, fusion, user]);

  if (authLoading || loading)
    return <div className="flex h-full w-full items-center justify-center"><LoaderCircle className="animate-spin h-8 w-8 text-blue-600" /></div>;

  if (!user)
    return <div className="flex h-full flex-col items-center justify-center text-center space-y-4"><h2 className="text-2xl font-semibold">{copy.signInTitle}</h2><Link to="/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">{copy.goToSignIn}</Link></div>;

  const latest = getLatestByModality(tests);
  const allModalities: ('spiral' | 'wave' | 'speech')[] = ['spiral', 'wave', 'speech'];
  const hasResults = allModalities.filter(m => latest[m] !== null);

  const RiskIcon = fusion
    ? fusion.riskLevel === 'High' ? ShieldAlert : fusion.riskLevel === 'Medium' ? Shield : ShieldCheck
    : Info;

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-primary/10 rounded-[2rem]">
            <Layers className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-4xl font-serif font-bold text-foreground tracking-tight">{copy.title}</h2>
            <p className="text-muted-foreground font-medium mt-1">{copy.subtitle}</p>
          </div>
        </div>
        <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed">{copy.description}</p>
      </motion.div>

      {fusion ? (
        <>
          {/* â•â•â• Beautiful Fusion Result Card â•â•â• */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} ref={reportRef}>
            <div className="relative bg-white/70 backdrop-blur-md border border-border/50 rounded-4xl shadow-float overflow-hidden pb-4">
              {/* Decorative accents */}
              <div className="absolute top-0 left-0 w-80 h-80 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/5 blur-3xl rounded-full pointer-events-none" />

              <div className="relative p-8">
                {/* Top row: Report title + actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-foreground flex items-center gap-3">
                      <div className={`p-2 rounded-2xl ${fusion.riskLevel === 'High' ? 'bg-destructive/10' : fusion.riskLevel === 'Medium' ? 'bg-secondary/10' : 'bg-primary/10'}`}>
                        <RiskIcon className="h-6 w-6" style={{ color: fusion.riskLevel === 'High' ? '#A85448' : fusion.riskLevel === 'Medium' ? '#C18C5D' : '#5D7052' }} />
                      </div>
                      {copy.reportTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 font-medium">{copy.modalitiesGenerated(fusion.modalitiesUsed.length, new Date().toLocaleDateString(locale))}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleSave} disabled={saving || saved}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-md active:scale-95 ${saved ? 'bg-primary/20 text-primary shadow-none' : 'bg-primary text-primary-foreground hover:bg-primary/90'} disabled:opacity-60`}>
                      {saving ? <LoaderCircle className="animate-spin h-4 w-4" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
                      {saved ? copy.saved : saving ? copy.saving : copy.saveReport}
                    </button>
                    <button onClick={() => exportToPDF(fusion, user.full_name || user.email || 'Patient', user.id)}
                      className="flex items-center gap-2 px-6 py-2.5 border-2 border-secondary text-secondary rounded-full font-bold text-sm hover:bg-secondary hover:text-secondary-foreground transition-all active:scale-95 shadow-sm hover:shadow-md">
                      <Download size={16} /> {copy.exportPdf}
                    </button>
                    <button onClick={() => { fetchTests(); setSaved(false); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 text-foreground border border-border/50 rounded-full text-sm hover:bg-muted transition-colors active:scale-95">
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>

                {/* Gauge + Radar side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
                  <div className="flex flex-col items-center justify-center py-4 bg-background/30 rounded-[2rem] border border-border/30 backdrop-blur-sm">
                    <FusionGauge score={fusion.fusionScore} riskLevel={fusion.riskLevel} label={`${translateRiskLevel(fusion.riskLevel, language)} ${copy.riskSuffix}`} />
                    <p className="text-sm font-medium text-muted-foreground mt-4 text-center">{copy.overallConfidence((fusion.confidence * 100).toFixed(0))}</p>
                  </div>
                  <div className="h-80 bg-background/30 rounded-[2rem] border border-border/30 backdrop-blur-sm p-4">
                    <h4 className="font-serif font-bold text-foreground mb-2 text-lg flex items-center gap-2 justify-center"><TrendingUp size={20} className="text-primary" /> {copy.modalityComparison}</h4>
                    <Chart option={getRadarOption(fusion, language, copy.scoreSeries)} />
                  </div>
                </div>

                {/* Breakdown weights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-2">
                  {fusion.breakdown.map(b => (
                    <div key={b.modality} className="bg-white/80 backdrop-blur-sm border border-border/50 rounded-[2rem] p-6 text-center shadow-sm hover:shadow-float transition-all hover:-translate-y-1">
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{translateModality(b.modality, language)}</p>
                      <p className="text-5xl font-serif font-extrabold mt-4" style={{ color: b.score >= 7 ? '#A85448' : b.score >= 4 ? '#C18C5D' : '#5D7052' }}>
                        {b.score.toFixed(1)}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border/30">
                        <span className="text-xs font-semibold text-muted-foreground">{copy.weight} {(b.weight * 100).toFixed(0)}%</span>
                        <span className="text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">&larr; {b.weightedContribution.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <p className="text-sm font-medium text-destructive mt-6 text-center bg-destructive/10 py-2 rounded-full">{error}</p>}
              </div>
            </div>
          </motion.div>

          {/* Breakdown bar chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
            <Card className="rounded-organic-1 bg-white/60">
              <h3 className="font-serif text-2xl font-bold text-foreground mb-6 flex items-center gap-3"><div className="p-2.5 bg-primary/10 rounded-2xl"><Layers size={22} className="text-primary" /></div> {copy.scoreBreakdownChart}</h3>
              <div className="h-72"><Chart option={getBreakdownOption(fusion, language, copy)} /></div>
            </Card>
          </motion.div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="text-center py-16 rounded-organic-2 bg-white/60 border-dashed border-2">
            <div className="bg-secondary/10 w-24 h-24 mx-auto rounded-[2.5rem] flex items-center justify-center mb-6">
              <AlertTriangle className="h-10 w-10 text-secondary" />
            </div>
            <h3 className="font-serif text-3xl font-bold text-foreground mb-4">{copy.insufficientDataTitle}</h3>
            <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8 leading-relaxed">{copy.insufficientDataBody(hasResults.length)}</p>
            <Link to="/new-test" className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-soft text-lg">
              {copy.takeTest} <ArrowRight size={20} />
            </Link>
          </Card>
        </motion.div>
      )}

      {/* Individual results */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
        <h3 className="font-serif text-3xl font-bold text-foreground mb-6">{copy.individualResults}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {allModalities.map((mod, i) => {
            const test = latest[mod];
            if (test) {
              const result: ModalityResult = {
                testId: test.id, testType: mod,
                label: (test.result as any)?.label || 'Unknown',
                confidence: (test.result as any)?.confidence ?? test.confidence ?? 0,
                parkinsonsProb: 0,
                riskScore: (test.result as any)?.riskScore ?? ((test.result as any)?.probabilities?.Parkinsons != null ? Number(((test.result as any).probabilities.Parkinsons * 10).toFixed(1)) : 0),
                timestamp: test.created_at,
              };
              return <ModalityCard key={mod} result={result} index={i} />;
            }
            return <MissingModalityCard key={mod} type={mod} index={i} />;
          })}
        </div>
      </motion.div>

      {/* Recommendations */}
      {fusion && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
          <Card className="rounded-organic-3 bg-white/60">
            <h3 className="font-serif text-2xl font-bold text-foreground mb-6 flex items-center gap-3"><div className="p-2.5 bg-primary/10 rounded-2xl"><CheckCircle size={22} className="text-primary" /></div> {copy.recommendations}</h3>
            <ul className="space-y-4">
              {fusion.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-4 text-base font-medium text-foreground">
                  <span className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">{i + 1}</span>
                  {rec}
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>
      )}

      {/* Disclaimer */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="bg-secondary/5 border border-secondary/20 rounded-[2rem] p-6 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-secondary/10 rounded-xl mt-0.5 flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <p className="text-base font-serif font-bold text-secondary">{copy.medicalDisclaimer}</p>
            <p className="text-sm font-medium text-secondary/80 mt-1.5 leading-relaxed tracking-wide">{copy.disclaimerBody}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

