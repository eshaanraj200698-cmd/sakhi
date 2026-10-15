import React from 'react';
import { X, Trash2, Calendar, AlertCircle, ArrowUpRight, Shield } from 'lucide-react';
import { SessionHistoryItem } from '../types.ts';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionHistoryItem[];
  onClearHistory: () => void;
  onSelectSession: (session: SessionHistoryItem) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  sessions,
  onClearHistory,
  onSelectSession
}) => {
  if (!isOpen) return null;

  // Trend analysis: count irregular cycle mentions
  const irregularCount = sessions.filter(
    (s) =>
      s.pattern_summary.toLowerCase().includes('irregular') ||
      s.pattern_summary.toLowerCase().includes('absent') ||
      s.symptoms_summary.some((sym) => sym.toLowerCase().includes('cycle') || sym.toLowerCase().includes('period'))
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 text-base">Your Health Check-ins</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {sessions.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local Storage Privacy Note */}
        <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 text-xs text-emerald-800">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>All records stay strictly on this device in your browser.</span>
        </div>

        {/* Trend Warning Card if recurrent irregular cycles */}
        {irregularCount >= 2 && (
          <div className="m-4 p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Multi-Check-in Trend Noted</span>
            </div>
            <p className="leading-relaxed">
              You have recorded cycle irregularity or missed periods across {irregularCount} separate check-ins. Consistent irregularity moves clinical guidance to <strong>schedule an in-person doctor consultation soon</strong> to protect uterine lining health.
            </p>
          </div>
        )}

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p>No check-ins saved yet.</p>
              <p className="mt-1 text-slate-500">
                Your past symptom analyses will appear here so you can monitor changes over time.
              </p>
            </div>
          ) : (
            sessions.map((sess) => {
              const dateStr = new Date(sess.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={sess._id}
                  onClick={() => onSelectSession(sess)}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:shadow-sm bg-white transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-500">{dateStr}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        sess.urgency === 'urgent'
                          ? 'bg-red-100 text-red-800'
                          : sess.urgency === 'soon'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {sess.urgency}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 line-clamp-2 italic mb-2">
                    "{sess.input_text}"
                  </p>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {sess.symptoms_summary.slice(0, 3).map((sym, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                      >
                        {sym}
                      </span>
                    ))}
                    {sess.symptoms_summary.length > 3 && (
                      <span className="text-[10px] text-slate-400">
                        +{sess.symptoms_summary.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>{sess.doctor_type}</span>
                    <span className="text-rose-600 group-hover:translate-x-0.5 transition flex items-center gap-0.5 font-medium">
                      View details <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Clear Button */}
        {sessions.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear My Data</span>
            </button>
            <span className="text-[11px] text-slate-400">Stored in localStorage</span>
          </div>
        )}
      </div>
    </div>
  );
};
