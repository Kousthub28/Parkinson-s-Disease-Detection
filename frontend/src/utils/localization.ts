import type { AppLanguage } from '../context/LanguageContext';

export const getLocale = (language: AppLanguage) => (language === 'kn' ? 'kn-IN' : 'en-US');

const modalityLabels = {
  spiral: { en: 'Spiral', kn: 'ಸ್ಪೈರಲ್' },
  wave: { en: 'Wave', kn: 'ಅಲೆ' },
  speech: { en: 'Voice', kn: 'ಧ್ವನಿ' },
  voice: { en: 'Voice', kn: 'ಧ್ವನಿ' },
  video: { en: 'Eye Movement', kn: 'ಕಣ್ಣಿನ ಚಲನ' },
  fusion: { en: 'Fusion', kn: 'ಫ್ಯೂಷನ್' },
  motor: { en: 'Motor', kn: 'ಚಲನೆ' },
  nutrition: { en: 'Nutrition', kn: 'ಪೋಷಣ' },
} as const;

const riskLabels = {
  Low: { en: 'Low', kn: 'ಕಡಿಮೆ' },
  Medium: { en: 'Medium', kn: 'ಮಧ್ಯಮ' },
  High: { en: 'High', kn: 'ಹೆಚ್ಚು' },
  Pending: { en: 'Pending', kn: 'ಬಾಕಿ' },
  'Pending Analysis': { en: 'Pending Analysis', kn: 'ವಿಶ್ಲೇಷಣೆ ಬಾಕಿ' },
} as const;

const summaryLabels = {
  Healthy: { en: 'Healthy', kn: 'ಆರೋಗ್ಯಕರ' },
  Parkinsons: { en: 'Parkinsons', kn: 'ಪಾರ್ಕಿನ್ಸನ್ಸ್' },
  'Healthy Control': { en: 'Healthy Control', kn: 'ಆರೋಗ್ಯಕರ ನಿಯಂತ್ರಣ' },
  'PD Detected': { en: 'PD Detected', kn: 'ಪಿಡಿ ಪತ್ತೆಯಾಗಿದೆ' },
  Unknown: { en: 'Unknown', kn: 'ಅಜ್ಞಾತ' },
  Saved: { en: 'Saved', kn: 'ಉಳಿಸಲಾಗಿದೆ' },
} as const;

const reportStatusLabels = {
  reviewed: { en: 'Reviewed', kn: 'ವಿಮರ್ಶಿಸಲಾಗಿದೆ' },
  completed: { en: 'Completed', kn: 'ಪೂರ್ಣಗೊಂಡಿದೆ' },
  pending: { en: 'Pending', kn: 'ಬಾಕಿ' },
} as const;

const appointmentStatusLabels = {
  pending: { en: 'Pending', kn: 'ಬಾಕಿ' },
  accepted: { en: 'Accepted', kn: 'ಸ್ವೀಕರಿಸಲಾಗಿದೆ' },
  completed: { en: 'Completed', kn: 'ಪೂರ್ಣಗೊಂಡಿದೆ' },
  rejected: { en: 'Rejected', kn: 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ' },
  cancelled: { en: 'Cancelled', kn: 'ರದ್ದಾಗಿದೆ' },
  scheduled: { en: 'Scheduled', kn: 'ನಿಗದಿಯಾಗಿದೆ' },
} as const;

export const translateModality = (value: string, language: AppLanguage) =>
  modalityLabels[value.toLowerCase() as keyof typeof modalityLabels]?.[language] || value;

export const translateRiskLevel = (value: string, language: AppLanguage) =>
  riskLabels[value as keyof typeof riskLabels]?.[language] || value;

export const translateSummaryLabel = (value: string, language: AppLanguage) =>
  summaryLabels[value as keyof typeof summaryLabels]?.[language] || value;

export const translateReportStatus = (value: string, language: AppLanguage) =>
  reportStatusLabels[value as keyof typeof reportStatusLabels]?.[language] || value;

export const translateAppointmentStatus = (value: string, language: AppLanguage) =>
  appointmentStatusLabels[value as keyof typeof appointmentStatusLabels]?.[language] || value;
