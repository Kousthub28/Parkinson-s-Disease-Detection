import { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, User, Send, LoaderCircle, AlertCircle, Volume2, VolumeX, Sparkles, Copy, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { postChatMessage } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import Card from '../components/Card';

const chatbotCopy = {
  en: {
    personalisedSupport: 'Personalised Parkinson\'s Support',
    aiCareCompanion: 'AI Care Companion',
    description: 'Ask focused questions about Parkinson\'s wellness, treatment routines, or caregiver planning. Tailor responses for the moment, and let the assistant read them aloud if hearing text is easier.',
    currentFocus: 'Current focus',
    responseStyle: 'Response style',
    responseStyleDesc: 'Shape how detailed the assistant should be.',
    focusArea: 'Focus area',
    focusAreaDesc: 'Guide the assistant toward what matters now.',
    suggestedPrompts: 'Suggested prompts',
    tapPrompt: 'Tap a prompt to ask it instantly.',
    conversation: 'Conversation',
    conversationDesc: 'Responses stay concise by default. Switch styles above for more detail.',
    stopAudio: 'Stop audio',
    playAudio: 'Play audio',
    copy: 'Copy',
    copied: 'Copied!',
    preparingAnswer: 'Preparing a tailored answer...',
    placeholder: 'Ask about symptom relief, exercise, medications, or emotional wellbeing...',
    dailyLiving: 'Daily living',
    dailyLivingDesc: 'Energy, sleep, routine adaptions',
    movementExercise: 'Movement & exercise',
    movementExerciseDesc: 'Balance, physiotherapy, stretching',
    medicationTiming: 'Medication & timing',
    medicationTimingDesc: 'Scheduling, side effects, adherence',
    moodCognition: 'Mood & cognition',
    moodCognitionDesc: 'Mental health, cognition, caregivers',
    biteSizeSummary: 'Bite-size summary',
    biteSizeDesc: '2-3 short paragraphs with clear actions',
    balancedGuidance: 'Balanced guidance',
    balancedDesc: 'Adds context plus next steps',
    deepDive: 'Deep dive',
    deepDiveDesc: 'Expanded explanation for planning',
    medTimingChecklist: 'Medication timing checklist',
    balanceDrills: 'Balance drills',
    improveSleep: 'Improve sleep quality',
  },
  kn: {
    personalisedSupport: 'ವೈಯಕ್ತೀಕೃತ ಪಾರ್ಕಿನ್ಸನ್ ಬೆಂಬಲ',
    aiCareCompanion: 'ಎಐ ಕೇರ್ ಕಂಪ್ಯಾನಿಯನ್',
    description: 'ಪಾರ್ಕಿನ್ಸನ್ ಕ್ಷೇಮ, ಚಿಕಿತ್ಸಾ ದಿನಚರಿಗಳು ಅಥವಾ ಕೆಯರ್‌ಗಿವರ್ ಯೋಜನೆಯ ಬಗ್ಗೆ ಕೇಂದ್ರೀಕೃತ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ. ಪ್ರತಿಕ್ರಿಯೆಗಳನ್ನು ಕ್ಷಣಕ್ಕೆ ಹೊಂದಿಸಿ, ಮತ್ತು ಪಠ್ಯವನ್ನು ಕೇಳುವುದು ಸುಲಭವಾದರೆ ಸಹಾಯಕನು ಅವನ್ನು ಓದಲು ಬಿಡಿ.',
    currentFocus: 'ಪ್ರಸ್ತುತ ಕೇಂದ್ರ',
    responseStyle: 'ಪ್ರತಿಕ್ರಿಯೆ ಶೈಲಿ',
    responseStyleDesc: 'ಸಹಾಯಕನು ಎಷ್ಟು ವಿವರವಾಗಿರಬೇಕು ಎಂಬುದನ್ನು ನಿರ್ಧರಿಸಿ.',
    focusArea: 'ಕೇಂದ್ರ ಕ್ಷೇತ್ರ',
    focusAreaDesc: 'ಸಹಾಯಕನನ್ನು ಈಗ ಮುಖ್ಯವಾದದ್ದರ ಕಡೆ ಮಾರ್ಗದರ್ಶಿಸಿ.',
    suggestedPrompts: 'ಸಲಹೆ ನೀಡಿದ ಪ್ರಾಂಪ್ಟ್‌ಗಳು',
    tapPrompt: 'ತತ್ಕ್ಷಣವೇ ಕೇಳಲು ಪ್ರಾಂಪ್ಟ್ ಅನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ.',
    conversation: 'ಸಂವಾದ',
    conversationDesc: 'ಪ್ರತಿಕ್ರಿಯೆಗಳು ಡೀಫಾಲ್ಟ್‌ನಲ್ಲಿ ಸಂಕ್ಷಿಪ್ತವಾಗಿರುತ್ತವೆ. ಹೆಚ್ಚಿನ ವಿವರಕ್ಕಾಗಿ ಮೇಲೆ ಶೈಲಿಗಳನ್ನು ಬದಲಾಯಿಸಿ.',
    stopAudio: 'ಆಡಿಯೋ ನಿಲ್ಲಿಸಿ',
    playAudio: 'ಆಡಿಯೋ ಪ್ಲೇ ಮಾಡಿ',
    copy: 'ನಕಲಿಸಿ',
    copied: 'ನಕಲಿಸಲಾಗಿದೆ!',
    preparingAnswer: 'ತಯಾರಾದ ಉತ್ತರವನ್ನು ಸಿದ್ಧಪಡಿಸುತ್ತಿದೆ...',
    placeholder: 'ಲಕ್ಷಣ ಶಮನ, ವ್ಯಾಯಾಮ, ಔಷಧಿಗಳು ಅಥವಾ ಮಾನಸಿಕ ಕ್ಷೇಮದ ಬಗ್ಗೆ ಕೇಳಿ...',
    dailyLiving: 'ದೈನಂದಿನ ಜೀವನ',
    dailyLivingDesc: 'ಶಕ್ತಿ, ನಿದ್ರೆ, ದಿನಚರಿ ಹೊಂದಾಣಿಕೆಗಳು',
    movementExercise: 'ಚಲನೆ ಮತ್ತು ವ್ಯಾಯಾಮ',
    movementExerciseDesc: 'ಸಮತೋಲನ, ಭೌತ ಚಿಕಿತ್ಸೆ, ಎಳೆತ',
    medicationTiming: 'ಔಷಧ ಮತ್ತು ಸಮಯ',
    medicationTimingDesc: 'ವೇಳಾಪಟ್ಟಿ, ಪರಿಣಾಮಗಳು, ಅನುಸರಣೆ',
    moodCognition: 'ಮನಸ್ಥಿತಿ ಮತ್ತು ಜ್ಞಾನ',
    moodCognitionDesc: 'ಮಾನಸಿಕ ಆರೋಗ್ಯ, ಜ್ಞಾನ, ಕೆಯರ್‌ಗಿವರ್‌ಗಳು',
    biteSizeSummary: 'ಕಡಿತದ ಸಾರಾಂಶ',
    biteSizeDesc: 'ಸ್ಪಷ್ಟ ಕ್ರಿಯೆಗಳೊಂದಿಗೆ 2-3 ಚಿಕ್ಕ ಪ್ಯಾರಾಗ್ರಾಫ್‌ಗಳು',
    balancedGuidance: 'ಸಮತೋಲಿತ ಮಾರ್ಗದರ್ಶನ',
    balancedDesc: 'ಸಂದರ್ಭವನ್ನು ಸೇರಿಸಿ ಮತ್ತು ಮುಂದಿನ ಹಂತಗಳು',
    deepDive: 'ಆಳವಾದ ಡೈವ್',
    deepDiveDesc: 'ಯೋಜನೆಗಾಗಿ ವಿಸ್ತೃತ ವಿವರಣೆ',
    medTimingChecklist: 'ಔಷಧ ಸಮಯ ಚೆಕ್‌ಲಿಸ್ಟ್',
    balanceDrills: 'ಸಮತೋಲನ ಡ್ರಿಲ್‌ಗಳು',
    improveSleep: 'ನಿದ್ರೆ ಗುಣಮಟ್ಟವನ್ನು ಸುಧಾರಿಸಿ',
  },
} as const;

interface Message {
  id: string;
  from: 'bot' | 'user';
  text: string;
}

type ResponseProfileKey = 'concise' | 'balanced' | 'detailed';

interface FocusArea {
  id: string;
  label: string;
  description: string;
  systemInstruction: string;
  temperature?: number;
}

interface QuickPrompt {
  id: string;
  label: string;
  text: string;
  tags?: string[];
}

const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11));

const Chatbot = () => {
  const { language } = useLanguage();
  const copy = chatbotCopy[language];

  const responseProfiles = {
    concise: {
      label: copy.biteSizeSummary,
      description: copy.biteSizeDesc,
      maxTokens: 220,
      systemInstruction: 'Keep responses under three short paragraphs and emphasise the most actionable steps.',
    },
    balanced: {
      label: copy.balancedGuidance,
      description: copy.balancedDesc,
      maxTokens: 420,
      systemInstruction: 'Provide a balanced response with concise context, key considerations, and practical next steps presented in short sections or bullet lists.',
    },
    detailed: {
      label: copy.deepDive,
      description: copy.deepDiveDesc,
      maxTokens: 650,
      systemInstruction: 'Offer a structured, in-depth explanation with headings or bullet lists. Keep it focused and no more than six concise paragraphs.',
    },
  } as const;

  const focusAreas: FocusArea[] = [
    {
      id: 'daily',
      label: copy.dailyLiving,
      description: copy.dailyLivingDesc,
      systemInstruction: 'Prioritise daily living strategies, adaptive routines, and practical tips for managing Parkinson\'s at home.',
      temperature: 0.55,
    },
    {
      id: 'movement',
      label: copy.movementExercise,
      description: copy.movementExerciseDesc,
      systemInstruction: 'Focus on safe mobility, exercise, stretching routines, and evidence-based physiotherapy advice relevant to Parkinson\'s.',
      temperature: 0.65,
    },
    {
      id: 'medication',
      label: copy.medicationTiming,
      description: copy.medicationTimingDesc,
      systemInstruction: 'Help organise medication timing, adherence habits, and side-effect awareness without prescribing dosages.',
      temperature: 0.5,
    },
    {
      id: 'mind',
      label: copy.moodCognition,
      description: copy.moodCognitionDesc,
      systemInstruction: 'Support emotional wellbeing, cognition exercises, and caregiver collaboration for Parkinson\'s care.',
      temperature: 0.7,
    },
  ];

  const quickPrompts: QuickPrompt[] = [
    {
      id: 'med-timing',
      label: copy.medTimingChecklist,
      text: 'Can you suggest a simple checklist to help me keep Parkinson\'s medications on schedule each day?',
      tags: ['medication'],
    },
    {
      id: 'balance-drills',
      label: copy.balanceDrills,
      text: 'What gentle balance and posture exercises are safe for someone with mid-stage Parkinson\'s?',
      tags: ['movement'],
    },
    {
      id: 'sleep-health',
      label: copy.improveSleep,
      text: 'How can I adjust my evening routine to sleep better with Parkinson\'s?',
      tags: ['daily'],
    },
    {
      id: 'stress-reset',
      label: 'Calm anxious moments',
      text: 'Share a brief breathing or mindfulness routine to steady tremors when I feel stressed.',
      tags: ['mind'],
    },
    {
      id: 'clinic-prep',
      label: 'Prep for neurologist visit',
      text: 'What questions should I prepare before my next neurologist appointment regarding Parkinson\'s progression?',
      tags: ['medication', 'daily'],
    },
    {
      id: 'care-partner',
      label: 'Support for care-partner',
      text: 'How can my care-partner and I share responsibilities without burning out?',
      tags: ['mind', 'daily'],
    },
  ];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      from: 'bot',
      text: 'Hello! I\'m your Parkinson\'s care assistant. Ask me about daily routines, symptom management, or how to prepare for appointments, and I\'ll keep the guidance focused and easy to act on.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseProfile, setResponseProfile] = useState<ResponseProfileKey>('concise');
  const [selectedFocus, setSelectedFocus] = useState<string>(focusAreas[0].id);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSpokenRef = useRef<string | null>(null);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  useEffect(() => {
    if (!speechSupported) return;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  useEffect(() => {
    if (!autoSpeak || !speechSupported || loading) return;
    const lastBotMessage = [...messages].reverse().find((msg) => msg.from === 'bot');
    if (lastBotMessage && lastBotMessage.id !== lastSpokenRef.current) {
      speakMessage(lastBotMessage);
    }
  }, [messages, autoSpeak, speechSupported, loading]);

  const sortedPrompts = useMemo(() => {
    const matching = quickPrompts.filter((prompt) => !prompt.tags || prompt.tags.includes(selectedFocus));
    const remaining = quickPrompts.filter((prompt) => prompt.tags && !prompt.tags.includes(selectedFocus));
    return [...matching, ...remaining];
  }, [selectedFocus]);

  const speakMessage = (message: Message) => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      setSpeakingMessageId(null);
    };
    setSpeakingMessageId(message.id);
    lastSpokenRef.current = message.id;
    window.speechSynthesis.speak(utterance);
  };

  const toggleSpeakForMessage = (message: Message) => {
    if (!speechSupported) return;
    if (speakingMessageId === message.id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    } else {
      speakMessage(message);
    }
  };

  const handleCopy = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      setError('Could not copy the response.');
    }
  };

  const sendMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { id: generateId(), from: 'user', text: trimmed };
    const updatedConversation = [...messages, userMessage];
    setMessages(updatedConversation);
    setInput('');
    setLoading(true);
    setError(null);

    const profile = responseProfiles[responseProfile];
    const focus = focusAreas.find((area) => area.id === selectedFocus);
    const instructionParts = [profile.systemInstruction, focus?.systemInstruction, 'Always keep the guidance relevant to Parkinson\'s care and wellness.'];
    const options = {
      maxTokens: profile.maxTokens,
      temperature: focus?.temperature ?? 0.6,
      systemInstruction: instructionParts.filter(Boolean).join(' '),
    };

    try {
      const response = await postChatMessage(updatedConversation, options);
      const botMessageText = response.choices?.[0]?.message?.content?.trim() || 'I\'m sorry, I couldn\'t process that.';
      const botMessage: Message = { id: generateId(), from: 'bot', text: botMessageText };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to get a response from the assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleQuickPrompt = (prompt: QuickPrompt) => {
    sendMessage(prompt.text);
  };

  const selectedProfile = responseProfiles[responseProfile];
  const selectedFocusArea = focusAreas.find((area) => area.id === selectedFocus)!;

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-6">
      <Card className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-purple-50 to-sky-50 border-blue-100 shadow-xl">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100 blur-3xl" aria-hidden />
        <div className="flex flex-col gap-6 relative md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center text-sm font-medium tracking-wide uppercase text-blue-600"><Sparkles className="mr-2 h-4 w-4" /> {copy.personalisedSupport}</p>
            <h2 className="text-3xl font-bold text-gray-900">{copy.aiCareCompanion}</h2>
            <p className="max-w-2xl text-gray-700">{copy.description}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-white px-5 py-4 text-sm shadow-lg">
            <p className="mb-1 font-semibold text-gray-700">{copy.currentFocus}</p>
            <p className="text-lg font-bold text-blue-600">{selectedFocusArea.label}</p>
            <p className="mt-1 text-xs text-gray-600">{selectedProfile.label} - {selectedProfile.description}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{copy.responseStyle}</h3>
              <p className="text-sm text-gray-600">{copy.responseStyleDesc}</p>
            </div>
            <SlidersHorizontal className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {Object.entries(responseProfiles).map(([key, profile]) => {
              const isActive = responseProfile === key;
              return (
                <button
                  key={key}
                  onClick={() => setResponseProfile(key as ResponseProfileKey)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${isActive ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                >
                  <p className="text-sm font-semibold">{profile.label}</p>
                  <p className="mt-1 text-xs text-gray-600">{profile.description}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{copy.focusArea}</h3>
              <p className="text-sm text-gray-600">{copy.focusAreaDesc}</p>
            </div>
            <Sparkles className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {focusAreas.map((area) => {
              const isActive = selectedFocus === area.id;
              return (
                <button
                  key={area.id}
                  onClick={() => setSelectedFocus(area.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${isActive ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                >
                  <p className="font-semibold">{area.label}</p>
                  <p className="mt-1 max-w-[14rem] text-xs text-gray-600">{area.description}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Accessibility</h3>
              <p className="text-sm text-gray-600">Enable playback or copy the latest guidance.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {speechSupported ? (
              <div className="flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2">
                <div>
                  <p className="font-medium text-gray-900">Auto-play responses</p>
                  <p className="text-xs text-gray-600">Have the assistant read new answers aloud automatically.</p>
                </div>
                <button
                  onClick={() => setAutoSpeak((prev) => !prev)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${autoSpeak ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {autoSpeak ? 'On' : 'Off'}
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-gray-300 px-3 py-3 text-gray-600">Text-to-speech is unavailable in this browser.</p>
            )}
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-xs text-gray-700">
              Tip: You can also copy any response using the clipboard icon next to it.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">{copy.suggestedPrompts}</h3>
            <p className="text-xs text-gray-600">{copy.tapPrompt}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedPrompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handleQuickPrompt(prompt)}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:border-blue-400 hover:bg-blue-50"
                disabled={loading}
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex min-h-[34rem] flex-1 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-lg lg:min-h-[42rem]">
        <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{copy.conversation}</h3>
            <p className="text-xs text-gray-600">{copy.conversationDesc}</p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>{selectedProfile.label}</p>
            <p>{selectedFocusArea.label}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex flex-col ${msg.from === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex items-start space-x-3 ${msg.from === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {msg.from === 'bot' ? <Bot className="h-8 w-8 flex-shrink-0 text-blue-600" /> : <User className="h-8 w-8 flex-shrink-0 text-gray-600" />}
                  <div className={`max-w-2xl rounded-2xl border p-3 shadow-sm ${msg.from === 'bot' ? 'border-gray-200 bg-gray-50 text-gray-900' : 'border-blue-700 bg-blue-600 text-white'}`}>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  </div>
                </div>
                {msg.from === 'bot' && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
                    {speechSupported && (
                      <button
                        onClick={() => toggleSpeakForMessage(msg)}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 hover:border-primary/60"
                      >
                        {speakingMessageId === msg.id ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                        {speakingMessageId === msg.id ? copy.stopAudio : copy.playAudio}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(msg)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 hover:border-primary/60"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedMessageId === msg.id ? copy.copied : copy.copy}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start space-x-3"
              >
                <Bot className="h-8 w-8 flex-shrink-0 text-primary-foreground" />
                <div className="flex max-w-2xl items-center space-x-2 rounded-2xl border border-border/60 bg-muted p-3">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>{copy.preparingAnswer}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
        {error && (
          <div className="mt-3 flex items-center space-x-2 rounded-lg bg-red-900/20 p-3 text-red-400">
            <AlertCircle size={20} />
            <p className="text-sm">{error}</p>
          </div>
        )}
        <div className="relative z-10 mt-4 flex flex-col gap-3 border-t border-border bg-white pt-4">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={copy.placeholder}
              autoFocus
              className="w-full rounded-lg border border-border bg-input p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
            <button onClick={handleSend} className="rounded-lg bg-primary p-3 text-primary-foreground disabled:opacity-50" disabled={loading}>
              <Send />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">This assistant supports, not replaces, your medical team. For urgent symptoms, contact a healthcare professional immediately.</p>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
