import React from 'react';
import { X, CheckCircle2, ShieldAlert, Cpu, Sparkles, Scale, Database } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm">
              4S
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">How SakhiCheck Works</h2>
              <p className="text-xs text-slate-500">The 4-stage clinical safety architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm text-slate-700">
          {/* Core Philosophy Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-100">
            <h3 className="font-semibold text-rose-900 mb-1 flex items-center gap-2">
              <Scale className="w-4 h-4 text-rose-600" />
              "Gemini Understands, Deterministic Rules Decide"
            </h3>
            <p className="text-xs text-rose-800 leading-relaxed">
              Large Language Models (LLMs) are prone to hallucinating medical conditions or diagnosing without clinical evidence. SakhiCheck separates <strong>natural language comprehension</strong> from <strong>clinical logic</strong>.
            </p>
          </div>

          {/* 4 Pipeline Stages */}
          <div className="space-y-4">
            {/* Stage 1 */}
            <div className="flex gap-4 items-start p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs">
                1
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Regional Language Extraction (Gemini 3.8 Flash)
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  You speak or type naturally in English, Hindi, Kannada, or code-mixed Hinglish/Kanglish. Gemini maps colloquial phrases onto a <strong>fixed taxonomy of 14 symptom keys</strong>. Every match must quote exact text evidence.
                </p>
              </div>
            </div>

            {/* Stage 2 */}
            <div className="flex gap-4 items-start p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs">
                2
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Dual Red-Flag Emergency Triage
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Both regex and the LLM scan for urgent symptoms: severe acute pelvic pain, soaking a pad every hour, fainting, or pregnancy with bleeding. If found, an immediate emergency warning is surfaced and PCOS analysis is skipped.
                </p>
              </div>
            </div>

            {/* Stage 3 */}
            <div className="flex gap-4 items-start p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                3
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                  Deterministic Rotterdam Consensus Matcher
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Rotterdam criteria require 2 out of 3 features:
                  (1) Ovulatory dysfunction, (2) Hyperandrogenism, (3) Polycystic ovaries on ultrasound.
                  Our deterministic code enforces that general hair shedding alone cannot trigger androgen criteria, respects denials ("periods normal"), and highlights that ultrasound requires medical imaging.
                </p>
              </div>
            </div>

            {/* Stage 4 */}
            <div className="flex gap-4 items-start p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-bold text-xs">
                4
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  Grade-6 Empathy Explanation & Doctor Pathway
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  A secondary prompt turns the structured findings into empathetic, Grade-6 reading-level explanations in your native language, complete with questions to ask your doctor, suggested lab tests, and a printable clinic summary.
                </p>
              </div>
            </div>
          </div>

          {/* Data Note */}
          <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>Privacy Guarantee:</strong> All personal health check-ins stay entirely on your device in local storage. Nothing is stored on an external database without your explicit action.
            </span>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
