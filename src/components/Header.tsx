import React from 'react';
import { ShieldCheck, Heart, Sparkles, BookOpen, History } from 'lucide-react';
import { LanguageCode } from '../types.ts';

interface HeaderProps {
  currentLang: LanguageCode;
  onSelectLang: (lang: LanguageCode) => void;
  onOpenHowItWorks: () => void;
  onOpenHistory: () => void;
  onOpenVapi: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentLang,
  onSelectLang,
  onOpenHowItWorks,
  onOpenHistory,
  onOpenVapi,
  historyCount
}) => {
  return (
    <header className="border-b border-rose-100 bg-white/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-200">
            <Heart className="w-5 h-5 fill-white/90" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">SakhiCheck</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/80 px-2 py-0.5 rounded-full">
                Women's Hormonal Health
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Understanding symptoms in your language • Rotterdam criteria logic
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* Live Vapi Voice AI Button */}
          <button
            onClick={onOpenVapi}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-white bg-rose-50 hover:bg-gradient-to-r hover:from-rose-600 hover:to-pink-600 border border-rose-200 rounded-lg shadow-xs transition cursor-pointer group"
            title="Start live interactive conversation with Vapi AI Voice Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-500 group-hover:text-white animate-spin [animation-duration:3s]" />
            <span>Voice AI (Vapi)</span>
          </button>

          {/* Language selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => onSelectLang('en')}
              className={`px-2.5 py-1 rounded-md transition ${
                currentLang === 'en'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              onClick={() => onSelectLang('hinglish')}
              className={`px-2.5 py-1 rounded-md transition ${
                currentLang === 'hinglish' || currentLang === 'hi'
                  ? 'bg-white text-rose-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              हिंदी / Hinglish
            </button>
            <button
              onClick={() => onSelectLang('kn')}
              className={`px-2.5 py-1 rounded-md transition ${
                currentLang === 'kn'
                  ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ಕನ್ನಡ (Kannada)
            </button>
          </div>

          {/* How It Works Button */}
          <button
            onClick={onOpenHowItWorks}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition"
            title="How SakhiCheck Works"
          >
            <BookOpen className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">How this works</span>
          </button>

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition relative"
            title="View Past Check-ins"
          >
            <History className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">My History</span>
            {historyCount > 0 && (
              <span className="w-4 h-4 text-[10px] bg-rose-500 text-white rounded-full flex items-center justify-center font-bold">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="bg-amber-50/90 border-t border-amber-200/60 px-4 py-1.5 text-center text-xs text-amber-900 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Medical Notice:</strong> SakhiCheck is an educational symptom understanding tool. It does <strong>not diagnose</strong> or prescribe medication. Always consult a licensed doctor.
        </span>
      </div>
    </header>
  );
};
