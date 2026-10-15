/**
 * SakhiCheck: Main Application Component
 * Women's Health & Symptom Understanding (PCOS Focus, Regional-Language Input)
 */

import React, { useState, useEffect } from 'react';
import {
  Heart,
  Mic,
  MicOff,
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Header } from './components/Header.tsx';
import { HowItWorksModal } from './components/HowItWorksModal.tsx';
import { DoctorSummaryModal } from './components/DoctorSummaryModal.tsx';
import { HistoryDrawer } from './components/HistoryDrawer.tsx';
import { ResultsView } from './components/ResultsView.tsx';
import { VapiAssistantModal } from './components/VapiAssistantModal.tsx';
import {
  ExtractionResult,
  MatchedResult,
  LanguageCode,
  SessionHistoryItem,
  ExtractedSymptom
} from './types.ts';
import { analyzeUserInput } from './services/extractionService.ts';
import { evaluateSymptoms } from './matcher.ts';
import { db } from './db.ts';

// Test Presets from Handoff Specification
const PRESETS = [
  {
    label: 'Classic PCOS',
    lang: 'en' as LanguageCode,
    badge: 'English',
    text: 'My periods come every 2-3 months, I have a lot of acne and facial hair'
  },
  {
    label: 'Missed Period + Hair Shedding',
    lang: 'hinglish' as LanguageCode,
    badge: 'Hinglish',
    text: 'mujhe 3 mahine se period nahi aaya aur baal jhad rahe hain'
  },
  {
    label: 'Kannada Irregular Cycle',
    lang: 'kn' as LanguageCode,
    badge: 'ಕನ್ನಡ',
    text: 'ನನಗೆ ಅನಿಯಮಿತ ಮುಟ್ಟು ಮತ್ತು ತೂಕ ಹೆಚ್ಚಾಗುವಿಕೆ ಸಮಸ್ಯೆ ಇದೆ'
  },
  {
    label: 'Dandruff & Shedding (Regular Periods)',
    lang: 'hinglish' as LanguageCode,
    badge: 'Bug 2 & 3 Denial',
    text: 'mere periods toh normal hain but mere baal bohot jhadte hain nahate time, dandruff bhi hai'
  },
  {
    label: 'Thyroid Differential Signs',
    lang: 'en' as LanguageCode,
    badge: 'Thyroid',
    text: 'Periods regular, tired, feeling cold all the time'
  },
  {
    label: 'Urgent Red Flag Emergency',
    lang: 'en' as LanguageCode,
    badge: 'Red Flag',
    text: "I'm soaking a pad every hour and feeling dizzy"
  },
  {
    label: 'Unrelated Symptom',
    lang: 'en' as LanguageCode,
    badge: 'General',
    text: 'My knee hurts when I run'
  }
];

export default function App() {
  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<string>('');

  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [matched, setMatched] = useState<MatchedResult | null>(null);

  // Modals state
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isDoctorSummaryOpen, setIsDoctorSummaryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isVapiModalOpen, setIsVapiModalOpen] = useState(false);
  const [isSessionSaved, setIsSessionSaved] = useState(false);

  // History state
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Initialize history and speech check
  useEffect(() => {
    setSessions(db.getLocalStoredSessions());

    const hasSpeech =
      typeof window !== 'undefined' &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setSpeechSupported(hasSpeech);
  }, []);

  // Voice Input Handler
  const handleToggleVoice = () => {
    if (!speechSupported) {
      alert('Speech recognition is not supported in this browser. Please type your symptoms.');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      // Set speech recognition language based on current selection
      if (selectedLanguage === 'kn') {
        recognition.lang = 'kn-IN';
      } else if (selectedLanguage === 'hi' || selectedLanguage === 'hinglish') {
        recognition.lang = 'hi-IN';
      } else {
        recognition.lang = 'en-IN';
      }

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = (err: any) => {
        console.error('Speech error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error('Failed to start speech:', e);
      setIsListening(false);
    }
  };

  // Run Analysis
  const handleAnalyze = async (textToAnalyze?: string, langOverride?: LanguageCode) => {
    const query = (textToAnalyze ?? inputText).trim();
    if (!query) return;

    const lang = langOverride ?? selectedLanguage;
    setIsAnalyzing(true);
    setIsSessionSaved(false);

    setPipelineStep('Understanding symptoms in your language...');

    try {
      const result = await analyzeUserInput(query, lang);
      setExtraction(result.extraction);
      setMatched(result.matched);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
      setPipelineStep('');
    }
  };

  // Modify Extracted Symptoms on the fly
  const handleModifySymptoms = (updatedSymptoms: ExtractedSymptom[]) => {
    if (!extraction) return;

    const updatedExtraction: ExtractionResult = {
      ...extraction,
      matched_keys: updatedSymptoms
    };

    // Re-evaluate deterministically
    const reEvaluated = evaluateSymptoms(updatedExtraction);
    // Preserve current explanation
    reEvaluated.plain_explanation = matched?.plain_explanation;

    setExtraction(updatedExtraction);
    setMatched(reEvaluated);
    setIsSessionSaved(false);
  };

  // Save Session to Local History
  const handleSaveToHistory = () => {
    if (!extraction || !matched || isSessionSaved) return;

    const newSession: SessionHistoryItem = {
      _id: `sess_${Date.now()}`,
      created_at: new Date().toISOString(),
      input_text: extraction.raw_text,
      language: extraction.user_language,
      symptoms_summary: extraction.matched_keys.map(
        (s) => s.label_display || s.key.replace(/_/g, ' ')
      ),
      urgency: matched.urgency,
      pattern_summary:
        matched.pcos_rotterdam?.status_label === 'aligns_with_pattern'
          ? 'Rotterdam PCOS Pattern Indicated'
          : matched.isolated_shedding_case
          ? 'Isolated Hair Shedding'
          : matched.surfaced_conditions[0]?.condition.name || 'Check-in Recorded',
      doctor_type: matched.doctor_specialist
    };

    db.saveSession(newSession);
    setSessions(db.getLocalStoredSessions());
    setIsSessionSaved(true);
  };

  // Clear Local History
  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your saved check-in history from this browser?')) {
      db.clearLocalSessions();
      setSessions([]);
    }
  };

  // Load a session from history
  const handleSelectHistorySession = (session: SessionHistoryItem) => {
    setInputText(session.input_text);
    setSelectedLanguage(session.language);
    setIsHistoryOpen(false);
    handleAnalyze(session.input_text, session.language);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-rose-100 selection:text-rose-900">
      {/* Top Header */}
      <Header
        currentLang={selectedLanguage}
        onSelectLang={(lang) => setSelectedLanguage(lang)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenVapi={() => setIsVapiModalOpen(true)}
        historyCount={sessions.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100/70 text-rose-800 text-xs font-semibold">
            <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
            <span>Empathetic, Non-Diagnostic Symptom Guidance</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Tell us what you are experiencing
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Describe cycle irregularities, hair changes, skin flare-ups, or fatigue in your everyday language.
            We use clinical Rotterdam criteria to prepare you for a supportive conversation with your doctor.
          </p>

          {/* Interactive Live Voice Banner */}
          <div className="pt-2">
            <button
              onClick={() => setIsVapiModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 hover:from-rose-700 hover:to-pink-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-200 hover:shadow-lg transition cursor-pointer group animate-in fade-in"
            >
              <Sparkles className="w-4 h-4 text-rose-200 group-hover:rotate-12 transition" />
              <span>Talk with Live Voice AI (Vapi)</span>
              <span className="text-[10px] font-extrabold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live Companion
              </span>
            </button>
          </div>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-4">
          {/* Preset Buttons for Quick Demo Testing */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                Quick Test Scenarios:
              </span>
              <span>Click to auto-populate & test</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(p.text);
                    setSelectedLanguage(p.lang);
                    handleAnalyze(p.text, p.lang);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200/60 transition flex items-center gap-1.5"
                >
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white text-slate-600 border border-slate-200">
                    {p.badge}
                  </span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. 'My periods come every 2-3 months, I have a lot of acne and facial hair' or 'mere periods 3 mahine se nahi aaye aur baal bohot jhad rahe hain'..."
              rows={4}
              className="w-full rounded-xl border border-slate-200 p-3.5 sm:p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition resize-none leading-relaxed"
            />

            {/* Action Bar inside/below text area */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {/* Vapi Live Call Trigger */}
                <button
                  type="button"
                  onClick={() => setIsVapiModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold transition"
                  title="Launch Vapi AI Live Voice Assistant"
                >
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                  <span>Talk with Sakhi</span>
                </button>

                {/* Browser Speech-to-text dictation button */}
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                    isListening
                      ? 'bg-red-500 text-white border-red-600 animate-pulse'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                  title="Dictate your symptoms into the text box"
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Listening... (Click to stop)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-slate-500" />
                      <span>Dictate</span>
                    </>
                  )}
                </button>

                {inputText.length > 0 && (
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    {inputText.trim().split(/\s+/).length} words
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex items-center gap-2">
                {inputText && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('');
                      setExtraction(null);
                      setMatched(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing || !inputText.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-200 transition disabled:opacity-50 disabled:shadow-none cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <>
                      <span>Understand My Symptoms</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Pipeline State Animation */}
        {isAnalyzing && (
          <div className="p-6 bg-white rounded-2xl border border-rose-100 text-center space-y-3 animate-in fade-in">
            <div className="w-10 h-10 mx-auto rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{pipelineStep}</h4>
              <p className="text-xs text-slate-500 mt-1">
                Applying Rotterdam clinical consensus logic & safety checks
              </p>
            </div>
          </div>
        )}

        {/* Results Area */}
        {matched && extraction && !isAnalyzing && (
          <ResultsView
            matched={matched}
            extraction={extraction}
            onOpenDoctorSummary={() => setIsDoctorSummaryOpen(true)}
            onModifySymptoms={handleModifySymptoms}
            onSaveToHistory={handleSaveToHistory}
            isSaved={isSessionSaved}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 space-y-2">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span className="font-semibold text-slate-700">SakhiCheck</span>
            <span>• Built for Hackathon: Women's Health & Symptom Understanding</span>
          </div>

          <div className="flex items-center gap-4 text-slate-600">
            <button
              onClick={() => setIsHowItWorksOpen(true)}
              className="hover:text-slate-900 transition"
            >
              How This Works
            </button>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="hover:text-slate-900 transition"
            >
              Saved Check-ins ({sessions.length})
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          This system provides non-diagnostic health educational guidance. Always consult a certified medical practitioner for diagnostic evaluation.
        </p>
      </footer>

      {/* Modals & Drawers */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />

      {matched && extraction && (
        <DoctorSummaryModal
          isOpen={isDoctorSummaryOpen}
          onClose={() => setIsDoctorSummaryOpen(false)}
          matched={matched}
          extraction={extraction}
        />
      )}

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        onClearHistory={handleClearHistory}
        onSelectSession={handleSelectHistorySession}
      />

      {/* Vapi AI Live Voice Assistant Modal */}
      <VapiAssistantModal
        isOpen={isVapiModalOpen}
        onClose={() => setIsVapiModalOpen(false)}
        onTransferTranscript={(transcript) => {
          setInputText(transcript);
          handleAnalyze(transcript, selectedLanguage);
        }}
        language={selectedLanguage}
      />
    </div>
  );
}
