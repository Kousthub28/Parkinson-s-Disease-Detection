import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClipboardList, LoaderCircle, MessageSquare, Plus, Save, Video } from 'lucide-react';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { getAppointments, getReportById, updateDoctorReport } from '../services/healthcareApi';
import type { AppointmentRecord, ReportStatus, UnifiedReport } from '../types/healthcare';
import { downloadUnifiedReportPdf } from '../utils/reportUtils';
import { getLocale, translateModality, translateReportStatus, translateRiskLevel, translateSummaryLabel } from '../utils/localization';

const reportCopy = {
  en: {
    notFound: 'Report not found',
    title: 'Unified Report',
    subtitle: 'AI analysis and doctor prescription live in the same clinical report.',
    downloadPdf: 'Download PDF',
    backToDashboard: 'Back to Dashboard',
    patient: 'Patient',
    reportStatus: 'Report Status',
    aiRiskScore: 'AI Risk Score',
    doctor: 'Doctor',
    notAssigned: 'Not assigned',
    aiResults: 'AI Results',
    aiResultsBody: 'Existing AI findings remain intact and are now paired with clinical review.',
    aiSummary: 'AI Summary',
    pendingClassification: 'Pending classification',
    confidence: 'Confidence',
    weight: 'Weight',
    recentAiTests: 'Recent AI Tests',
    testSuffix: 'test',
    aiDataReady: 'AI data ready',
    aiRecommendations: 'AI Recommendations',
    doctorReview: 'Doctor Review',
    doctorReviewBody: 'Clinical notes, prescription, and suggestions update this same report document.',
    reviewingDoctor: 'Reviewing Doctor',
    consultationAccess: 'Consultation Access',
    consultationBody: 'Use the linked appointment dashboard card to open the active call room.',
    startCall: 'Start Call',
    joinCall: 'Join Call',
    openChat: 'Open Chat',
    availableAfterAcceptance: 'Available after doctor acceptance',
    notes: 'Notes',
    notesPlaceholder: 'Add clinical notes based on the linked AI results and consultation.',
    prescription: 'Prescription',
    prescriptionPlaceholder: 'Add one prescription line',
    add: 'Add',
    suggestions: 'Suggestions',
    suggestionsPlaceholder: 'Lifestyle suggestions, monitoring plans, and next steps.',
    statusLabel: 'Report Status',
    reviewed: 'Reviewed',
    completed: 'Completed',
    pending: 'Pending',
    saveDoctorReview: 'Save Doctor Review',
    doctorNotesMissing: 'Doctor notes have not been added yet.',
    noPrescription: 'No prescription added yet.',
    doctorSuggestionsMissing: 'Doctor suggestions have not been added yet.',
    saved: 'Saved',
  },
  kn: {
    notFound: 'ವರದಿ ಕಂಡುಬಂದಿಲ್ಲ',
    title: 'ಏಕೀಕೃತ ವರದಿ',
    subtitle: 'ಎಐ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ವೈದ್ಯರ ಔಷಧ ಪತ್ರಿಕೆ ಒಂದೇ ಕ್ಲಿನಿಕಲ್ ವರದಿಯಲ್ಲಿ ಇರುತ್ತವೆ.',
    downloadPdf: 'PDF ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
    backToDashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹಿಂತಿರುಗಿ',
    patient: 'ರೋಗಿ',
    reportStatus: 'ವರದಿ ಸ್ಥಿತಿ',
    aiRiskScore: 'ಎಐ ಅಪಾಯ ಸ್ಕೋರ್',
    doctor: 'ವೈದ್ಯರು',
    notAssigned: 'ನಿಯೋಜಿಸಲ್ಪಟ್ಟಿಲ್ಲ',
    aiResults: 'ಎಐ ಫಲಿತಾಂಶಗಳು',
    aiResultsBody: 'ಈಗಿರುವ ಎಐ ಕಂಡುಹಿಡಿಕೆಗಳು ಹಾಗೇ ಉಳಿದು ಕ್ಲಿನಿಕಲ್ ವಿಮರ್ಶೆಯೊಂದಿಗೆ ಜೊತೆಯಾಗಿ ಕಾಣಿಸುತ್ತವೆ.',
    aiSummary: 'ಎಐ ಸಾರಾಂಶ',
    pendingClassification: 'ವರ್ಗೀಕರಣ ಬಾಕಿ',
    confidence: 'ವಿಶ್ವಾಸ',
    weight: 'ತೂಕ',
    recentAiTests: 'ಇತ್ತೀಚಿನ ಎಐ ಪರೀಕ್ಷೆಗಳು',
    testSuffix: 'ಪರೀಕ್ಷೆ',
    aiDataReady: 'ಎಐ ಡೇಟಾ ಸಿದ್ಧವಾಗಿದೆ',
    aiRecommendations: 'ಎಐ ಶಿಫಾರಸುಗಳು',
    doctorReview: 'ವೈದ್ಯರ ವಿಮರ್ಶೆ',
    doctorReviewBody: 'ಕ್ಲಿನಿಕಲ್ ಟಿಪ್ಪಣಿಗಳು, ಔಷಧ ಪತ್ರಿಕೆ ಮತ್ತು ಸಲಹೆಗಳು ಇದೇ ವರದಿಯನ್ನು ನವೀಕರಿಸುತ್ತವೆ.',
    reviewingDoctor: 'ವಿಮರ್ಶಿಸುವ ವೈದ್ಯರು',
    consultationAccess: 'ಸಲಹೆ ಪ್ರವೇಶ',
    consultationBody: 'ಸಕ್ರಿಯ ಕರೆ ಕೊಠಡಿಯನ್ನು ತೆರೆಯಲು ಸಂಬಂಧಿಸಿದ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಕಾರ್ಡ್ ಬಳಸಿ.',
    startCall: 'ಕರೆ ಪ್ರಾರಂಭಿಸಿ',
    joinCall: 'ಕರೆಗೆ ಸೇರಿ',
    openChat: 'ಚಾಟ್ ತೆರೆಯಿರಿ',
    availableAfterAcceptance: 'ವೈದ್ಯರ ಅಂಗೀಕಾರದ ನಂತರ ಲಭ್ಯ',
    notes: 'ಟಿಪ್ಪಣಿಗಳು',
    notesPlaceholder: 'ಸಂಬಂಧಿಸಿದ ಎಐ ಫಲಿತಾಂಶಗಳು ಮತ್ತು ಸಲಹೆಯನ್ನು ಆಧರಿಸಿ ಕ್ಲಿನಿಕಲ್ ಟಿಪ್ಪಣಿಗಳನ್ನು ಸೇರಿಸಿ.',
    prescription: 'ಔಷಧ ಪತ್ರಿಕೆ',
    prescriptionPlaceholder: 'ಒಂದು ಔಷಧ ಸಾಲನ್ನು ಸೇರಿಸಿ',
    add: 'ಸೇರಿಸಿ',
    suggestions: 'ಸಲಹೆಗಳು',
    suggestionsPlaceholder: 'ಜೀವನಶೈಲಿ ಸಲಹೆಗಳು, ಮೇಲ್ವಿಚಾರಣಾ ಯೋಜನೆಗಳು ಮತ್ತು ಮುಂದಿನ ಹಂತಗಳು.',
    statusLabel: 'ವರದಿ ಸ್ಥಿತಿ',
    reviewed: 'ವಿಮರ್ಶಿಸಲಾಗಿದೆ',
    completed: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
    pending: 'ಬಾಕಿ',
    saveDoctorReview: 'ವೈದ್ಯರ ವಿಮರ್ಶೆ ಉಳಿಸಿ',
    doctorNotesMissing: 'ವೈದ್ಯರ ಟಿಪ್ಪಣಿಗಳನ್ನು ಇನ್ನೂ ಸೇರಿಸಲಾಗಿಲ್ಲ.',
    noPrescription: 'ಇನ್ನೂ ಯಾವುದೇ ಔಷಧ ಪತ್ರಿಕೆ ಸೇರಿಸಲಾಗಿಲ್ಲ.',
    doctorSuggestionsMissing: 'ವೈದ್ಯರ ಸಲಹೆಗಳನ್ನು ಇನ್ನೂ ಸೇರಿಸಲಾಗಿಲ್ಲ.',
    saved: 'ಉಳಿಸಲಾಗಿದೆ',
  },
} as const;

const ReportDetails = () => {
  const { reportId } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const copy = reportCopy[language];
  const locale = getLocale(language);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<UnifiedReport | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [status, setStatus] = useState<ReportStatus>('reviewed');
  const [prescriptionInput, setPrescriptionInput] = useState('');
  const [prescription, setPrescription] = useState<string[]>([]);
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      if (!reportId) {
        setLoading(false);
        return;
      }

      try {
        const data = await getReportById(reportId);
        setReport(data);
        setDoctorNotes(data.doctorNotes || '');
        setSuggestions(data.suggestions || '');
        setPrescription(data.prescription || []);
        setStatus(data.status || 'reviewed');
        const appointments = await getAppointments().catch(() => []);
        const linkedAppointment = appointments.find((item) => item.id === data.appointment_id)
          || appointments.find((item) => item.report_id === data.id)
          || null;
        setAppointment(linkedAppointment);
      } catch (error) {
        console.error('Failed to load report:', error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [reportId]);

  const canEditDoctorSection = user?.role === 'doctor' && user.approval_status === 'approved';
  const backLink = useMemo(() => {
    if (user?.role === 'doctor') return '/doctor-dashboard';
    if (user?.role === 'admin') return '/admin-dashboard';
    return '/patient-dashboard';
  }, [user?.role]);

  const translateResultLabel = (value?: string | null) => {
    if (!value) return copy.saved;
    const riskLabel = translateRiskLevel(value, language);
    if (riskLabel !== value) return riskLabel;
    return translateSummaryLabel(value, language);
  };

  const addPrescriptionLine = () => {
    const nextItem = prescriptionInput.trim();
    if (!nextItem) return;
    setPrescription((current) => [...current, nextItem]);
    setPrescriptionInput('');
  };

  const removePrescriptionLine = (index: number) => {
    setPrescription((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDoctorSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reportId) return;

    setSaving(true);
    try {
      const updated = await updateDoctorReport(reportId, {
        doctorNotes,
        prescription,
        suggestions,
        status,
      });
      setReport(updated);
      const appointments = await getAppointments().catch(() => []);
      const linkedAppointment = appointments.find((item) => item.id === updated.appointment_id)
        || appointments.find((item) => item.report_id === updated.id)
        || null;
      setAppointment(linkedAppointment);
    } catch (error) {
      console.error('Failed to update report:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!report) {
    return (
      <Card className="rounded-organic-2 bg-background/70">
        <p className="text-2xl font-serif font-bold text-foreground">{copy.notFound}</p>
      </Card>
    );
  }

  const fusion = report.aiResults?.fusion as Record<string, any> | null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-[2rem] bg-primary/10 p-4">
            <ClipboardList className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-4xl font-serif font-bold text-foreground">{copy.title}</h2>
            <p className="text-muted-foreground mt-1">{copy.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => downloadUnifiedReportPdf(report, report.patientDetails?.full_name)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {copy.downloadPdf}
          </button>
          <Link
            to={backLink}
            className="inline-flex items-center gap-2 rounded-full border border-border/50 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
          >
            {copy.backToDashboard}
          </Link>
        </div>
      </div>

      <Card className="rounded-organic-4 bg-background/70">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.patient}</p>
            <p className="text-xl font-serif font-bold text-foreground mt-1">{report.patientDetails?.full_name}</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.reportStatus}</p>
            <p className="text-xl font-serif font-bold text-foreground mt-1 capitalize">{translateReportStatus(report.status, language)}</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.aiRiskScore}</p>
            <p className="text-xl font-serif font-bold text-foreground mt-1">{typeof report.aiResults?.summary?.riskScore === 'number' ? `${report.aiResults.summary.riskScore.toFixed(1)} / 10` : 'N/A'}</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.doctor}</p>
            <p className="text-xl font-serif font-bold text-foreground mt-1">{report.doctorDetails?.full_name || copy.notAssigned}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-organic-1 bg-background/70">
          <div className="border-b border-border/30 pb-4">
            <h3 className="text-2xl font-serif font-bold text-foreground">{copy.aiResults}</h3>
            <p className="text-sm text-muted-foreground mt-1">{copy.aiResultsBody}</p>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.aiSummary}</p>
              <p className="text-xl font-serif font-bold text-foreground mt-2">{report.aiResults?.summary?.label ? translateResultLabel(report.aiResults.summary.label) : copy.pendingClassification}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {copy.confidence}: {typeof report.aiResults?.summary?.confidence === 'number'
                  ? `${(report.aiResults.summary.confidence * 100).toFixed(1)}%`
                  : 'N/A'}
              </p>
            </div>

            {fusion?.breakdown?.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {fusion.breakdown.map((item: any) => (
                  <div key={item.modality} className="rounded-2xl border border-border/40 bg-background/50 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{translateModality(item.modality, language)}</p>
                    <p className="text-2xl font-serif font-bold text-foreground mt-2">{item.score?.toFixed?.(1) ?? item.score} / 10</p>
                    <p className="text-xs text-muted-foreground mt-2">{copy.weight} {(item.weight * 100).toFixed(0)}%</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.recentAiTests}</p>
              <div className="mt-3 space-y-3">
                {report.aiResults?.recentTests?.map((test) => (
                  <div key={test.id} className="flex items-center justify-between rounded-2xl bg-background/60 px-4 py-3">
                    <div>
                      <p className="font-semibold text-foreground capitalize">{translateModality(test.test_type, language)} {copy.testSuffix}</p>
                      <p className="text-xs text-muted-foreground">{new Date(test.created_at).toLocaleString(locale)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{translateResultLabel(test.result?.riskLevel || test.result?.label)}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeof test.result?.riskScore === 'number' ? `${test.result.riskScore.toFixed(1)} / 10` : copy.aiDataReady}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {fusion?.recommendations?.length ? (
              <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.aiRecommendations}</p>
                <div className="mt-3 space-y-2">
                  {fusion.recommendations.map((item: string, index: number) => (
                    <p key={`${item}-${index}`} className="text-sm text-foreground">{index + 1}. {item}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="rounded-organic-3 bg-background/70">
          <div className="border-b border-border/30 pb-4">
            <h3 className="text-2xl font-serif font-bold text-foreground">{copy.doctorReview}</h3>
            <p className="text-sm text-muted-foreground mt-1">{copy.doctorReviewBody}</p>
          </div>

          <div className="mt-5 space-y-4">
            {report.doctorDetails?.hospital ? (
              <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.reviewingDoctor}</p>
                <p className="text-lg font-serif font-bold text-foreground mt-2">{report.doctorDetails.full_name}</p>
                <p className="text-sm text-muted-foreground mt-1">{report.doctorDetails.hospital}</p>
              </div>
            ) : null}

            {(appointment || report.appointment_id) && report.doctorDetails && (
              <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.consultationAccess}</p>
                <p className="text-sm text-muted-foreground mt-2">{copy.consultationBody}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {appointment?.call_url && appointment.status === 'accepted' && (
                    <a
                      href={appointment.call_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Video className="h-4 w-4" /> {user?.role === 'doctor' ? copy.startCall : copy.joinCall}
                    </a>
                  )}
                  {appointment?.status === 'accepted' ? (
                    <Link
                      to={`/appointments/${appointment?.id || report.appointment_id}/communication`}
                      className="inline-flex items-center gap-2 rounded-full border border-border/50 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <MessageSquare className="h-4 w-4" /> {copy.openChat}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/40 px-5 py-2.5 text-sm font-semibold text-muted-foreground">
                      <MessageSquare className="h-4 w-4" /> {copy.availableAfterAcceptance}
                    </span>
                  )}
                </div>
              </div>
            )}

            {canEditDoctorSection ? (
              <form onSubmit={handleDoctorSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">{copy.notes}</label>
                  <textarea
                    value={doctorNotes}
                    onChange={(event) => setDoctorNotes(event.target.value)}
                    className="min-h-[120px] w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={copy.notesPlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">{copy.prescription}</label>
                  <div className="flex gap-2">
                    <input
                      value={prescriptionInput}
                      onChange={(event) => setPrescriptionInput(event.target.value)}
                      className="flex-1 rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={copy.prescriptionPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={addPrescriptionLine}
                      className="inline-flex items-center gap-2 rounded-full border border-border/50 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <Plus className="h-4 w-4" /> {copy.add}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prescription.map((item, index) => (
                      <button
                        key={`${item}-${index}`}
                        type="button"
                        onClick={() => removePrescriptionLine(index)}
                        className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">{copy.suggestions}</label>
                  <textarea
                    value={suggestions}
                    onChange={(event) => setSuggestions(event.target.value)}
                    className="min-h-[120px] w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={copy.suggestionsPlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">{copy.statusLabel}</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as ReportStatus)}
                    className="w-full rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="reviewed">{copy.reviewed}</option>
                    <option value="completed">{copy.completed}</option>
                    <option value="pending">{copy.pending}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {copy.saveDoctorReview}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.notes}</p>
                  <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{report.doctorNotes || copy.doctorNotesMissing}</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.prescription}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.prescription?.length
                      ? report.prescription.map((item, index) => (
                        <span key={`${item}-${index}`} className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                          {item}
                        </span>
                      ))
                      : <p className="text-sm text-muted-foreground">{copy.noPrescription}</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{copy.suggestions}</p>
                  <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{report.suggestions || copy.doctorSuggestionsMissing}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportDetails;
