import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Stethoscope,
  HelpCircle,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  FileText,
  Copy,
  Check,
  Info,
  Activity,
  Droplets,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { MatchedResult, ExtractionResult, ExtractedSymptom } from '../types.ts';
import { db } from '../db.ts';

interface ResultsViewProps {
  matched: MatchedResult;
  extraction: ExtractionResult;
  onOpenDoctorSummary: () => void;
  onModifySymptoms: (updatedSymptoms: ExtractedSymptom[]) => void;
  onSaveToHistory: () => void;
  isSaved: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  matched,
  extraction,
  onOpenDoctorSummary,
  onModifySymptoms,
  onSaveToHistory,
  isSaved
}) => {
  const [copiedQuestionIdx, setCopiedQuestionIdx] = useState<number | null>(null);
  const [showAddSymptom, setShowAddSymptom] = useState(false);
  const [selectedAddKey, setSelectedAddKey] = useState('');
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const handleCopyQuestion = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionIdx(idx);
    setTimeout(() => setCopiedQuestionIdx(null), 2000);
  };

  const handleRemoveSymptom = (keyToRemove: string) => {
    const updated = extraction.matched_keys.filter((s) => s.key !== keyToRemove);
    onModifySymptoms(updated);
  };

  const handleAddSymptom = () => {
    if (!selectedAddKey) return;
    const symObj = db.getSymptomByKey(selectedAddKey);
    if (!symObj) return;

    if (extraction.matched_keys.some((s) => s.key === selectedAddKey)) {
      setShowAddSymptom(false);
      return;
    }

    const newSymptom: ExtractedSymptom = {
      key: selectedAddKey,
      evidence: 'Manually added by user',
      confidence_note: 'User indicated presence of this symptom',
      label_display: symObj.label_en
    };

    onModifySymptoms([...extraction.matched_keys, newSymptom]);
    setSelectedAddKey('');
    setShowAddSymptom(false);
  };

  const allSymptomsList = db.getSymptoms();

  // 1. Red Flag Emergency View (Bypasses PCOS Analysis)
  if (matched.red_flag_triggered) {
    const rf = matched.active_red_flags[0];
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="p-6 sm:p-8 rounded-2xl bg-red-600 text-white shadow-xl shadow-red-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                Urgent Clinical Action Required
              </span>
              <h2 className="text-xl sm:text-2xl font-black mt-1 tracking-tight">
                Immediate Medical Care Advised
              </h2>
            </div>
          </div>

          <div className="p-4 bg-white/10 rounded-xl border border-white/20 text-white/95 text-sm sm:text-base leading-relaxed">
            {matched.plain_explanation || rf?.message.en}
          </div>

          <div className="pt-2 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="bg-black/15 p-3 rounded-lg">
              <span className="font-semibold block text-red-100">Recommended Facility:</span>
              <span className="font-bold">{matched.doctor_specialist}</span>
            </div>
            <div className="bg-black/15 p-3 rounded-lg">
              <span className="font-semibold block text-red-100">Action Plan:</span>
              <span className="font-medium">Have someone drive you to the nearest ER / Gynecological casualty.</span>
            </div>
          </div>
        </div>

        {/* Emergency Questions */}
        <div className="p-5 bg-white rounded-xl border border-red-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-red-600" />
            Questions for Emergency Doctors
          </h3>
          <ul className="space-y-2 text-xs text-slate-700">
            {matched.questions_to_ask.map((q, i) => (
              <li key={i} className="flex items-start gap-2 p-2 bg-red-50/50 rounded border border-red-100">
                <span className="font-bold text-red-600">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // 2. Unrelated Symptoms View
  if (matched.is_unrelated) {
    return (
      <div className="p-6 sm:p-8 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3 text-slate-700">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">General Health Consultation</h2>
            <p className="text-xs text-slate-500">Non-hormonal symptom evaluation</p>
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
          {matched.plain_explanation || matched.unrelated_message}
        </p>

        <div className="flex items-center justify-between p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900">
          <span className="font-semibold">Recommended Healthcare Provider:</span>
          <span className="font-bold text-blue-800">{matched.doctor_specialist}</span>
        </div>
      </div>
    );
  }

  // 3. Comprehensive Standard Results View
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Overview & Empathy Explainer Card */}
      <div className="p-5 sm:p-6 bg-gradient-to-br from-rose-50 via-white to-pink-50/40 rounded-2xl border border-rose-100 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-rose-700">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
              What This Means For You
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                matched.urgency === 'soon'
                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
              }`}
            >
              Consultation Timing: {matched.urgency === 'soon' ? 'Soon (2-4 Weeks)' : 'Routine'}
            </span>
          </div>
        </div>

        {/* Localized Plain-Language Explanation */}
        <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal bg-white/80 p-4 rounded-xl border border-rose-100/60 shadow-xs">
          {matched.plain_explanation}
        </p>

        {/* Quick action bar */}
        <div className="flex flex-wrap items-center justify-between pt-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDoctorSummary}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Doctor-Visit Summary</span>
            </button>
            <button
              onClick={onSaveToHistory}
              disabled={isSaved}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium border transition ${
                isSaved
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isSaved ? 'Saved to Device' : 'Save Check-in'}</span>
            </button>
          </div>

          <div className="text-slate-500 text-[11px] flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Rotterdam 2004/2023 international framework</span>
          </div>
        </div>
      </div>

      {/* Card 1: What We Understood (Extracted Symptoms with Quoted Evidence) */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-600" />
              What We Understood From Your Words
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Exact phrases identified from your note. You can remove or add items below.
            </p>
          </div>
          <button
            onClick={() => setShowAddSymptom(!showAddSymptom)}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add item</span>
          </button>
        </div>

        {/* Add Symptom Dropdown */}
        {showAddSymptom && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedAddKey}
              onChange={(e) => setSelectedAddKey(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="">Select a symptom to add...</option>
              {allSymptomsList.map((sym) => (
                <option key={sym.key} value={sym.key}>
                  {sym.label_en} ({sym.category})
                </option>
              ))}
            </select>
            <button
              onClick={handleAddSymptom}
              disabled={!selectedAddKey}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddSymptom(false)}
              className="px-2 py-1.5 text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Chips with Quoted Evidence */}
        <div className="flex flex-wrap gap-2.5">
          {extraction.matched_keys.map((symptom) => (
            <div
              key={symptom.key}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-rose-50/50 border border-slate-200 text-xs transition group"
            >
              <div>
                <span className="font-semibold text-slate-900 block">
                  {symptom.label_display || symptom.key.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] text-slate-500 italic block">
                  "{symptom.evidence}"
                </span>
              </div>
              <button
                onClick={() => handleRemoveSymptom(symptom.key)}
                className="text-slate-300 hover:text-red-500 p-0.5 rounded transition"
                title="Remove this item"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Menstrual cycle status pill */}
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50/70 border border-rose-200 text-xs">
            <div>
              <span className="font-semibold text-rose-900 block">
                Menstrual Cycle Pattern
              </span>
              <span className="text-[11px] text-rose-700 capitalize">
                {extraction.cycle_pattern === 'absent'
                  ? `Amenorrhea (~${extraction.cycle_gap_months_approx || 3} months no period)`
                  : extraction.cycle_pattern === 'regular'
                  ? 'Reported Normal / Regular'
                  : extraction.cycle_pattern}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Patterns Worth Discussing With a Doctor (Rotterdam Consensus) */}
      {matched.pcos_rotterdam && (
        <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Patterns Worth Discussing With a Doctor
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluated deterministically against the 3 pillars of the Rotterdam consensus criteria
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                matched.pcos_rotterdam.status_label === 'aligns_with_pattern'
                  ? 'bg-rose-100 text-rose-900 border border-rose-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {matched.pcos_rotterdam.status_label === 'aligns_with_pattern'
                ? 'Aligns with PCOS Pattern'
                : matched.pcos_rotterdam.status_label === 'isolated_sign'
                ? 'Isolated Feature'
                : 'Diff. Investigation'}
            </span>
          </div>

          {/* Rotterdam 3 Pillars Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Pillar 1: Ovulatory */}
            <div
              className={`p-4 rounded-xl border ${
                matched.pcos_rotterdam.ovulatory_status === 'reported_irregular'
                  ? 'bg-rose-50/40 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800">1. Ovulatory Rhythm</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    matched.pcos_rotterdam.ovulatory_status === 'reported_irregular'
                      ? 'bg-rose-200 text-rose-900'
                      : matched.pcos_rotterdam.ovulatory_status === 'reported_regular'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {matched.pcos_rotterdam.ovulatory_status === 'reported_irregular'
                    ? 'Irregular / Absent'
                    : matched.pcos_rotterdam.ovulatory_status === 'reported_regular'
                    ? 'Regular'
                    : 'Unstated'}
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Cycles over 35 days or missed periods for 3+ months.
              </p>
              {matched.pcos_rotterdam.ovulatory_evidence && (
                <p className="mt-2 text-[11px] text-slate-500 italic border-t border-slate-200/60 pt-1.5">
                  "{matched.pcos_rotterdam.ovulatory_evidence}"
                </p>
              )}
            </div>

            {/* Pillar 2: Androgen Signs */}
            <div
              className={`p-4 rounded-xl border ${
                matched.pcos_rotterdam.androgen_status === 'reported_signs'
                  ? 'bg-rose-50/40 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800">2. Androgen Signs</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    matched.pcos_rotterdam.androgen_status === 'reported_signs'
                      ? 'bg-rose-200 text-rose-900'
                      : matched.pcos_rotterdam.androgen_status === 'weak_or_isolated_shedding'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {matched.pcos_rotterdam.androgen_status === 'reported_signs'
                    ? 'Reported Signs'
                    : matched.pcos_rotterdam.androgen_status === 'weak_or_isolated_shedding'
                    ? 'Weak / Shedding Only'
                    : 'None Reported'}
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Coarse facial hair, persistent cystic acne, or crown pattern thinning.
              </p>
              {matched.pcos_rotterdam.androgen_features.length > 0 && (
                <ul className="mt-2 text-[11px] text-slate-700 list-disc list-inside border-t border-slate-200/60 pt-1.5">
                  {matched.pcos_rotterdam.androgen_features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pillar 3: Pelvic Ultrasound (Always Present) */}
            <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800">3. Pelvic Ultrasound</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900">
                  Doctor Orderable
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Requires imaging of ovaries to assess follicle distribution.
              </p>
              <p className="mt-2 text-[11px] font-medium text-indigo-700 border-t border-slate-200/60 pt-1.5">
                {matched.pcos_rotterdam.ultrasound_note}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Special Guidance: Bug 3 Isolated Hair Shedding Card */}
      {matched.isolated_shedding_case && matched.isolated_shedding_data && (
        <div className="p-5 sm:p-6 bg-amber-50/80 rounded-2xl border border-amber-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-900">
            <Droplets className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="font-bold text-base">Important Note on Hair Shedding Without Period Issues</h3>
          </div>
          <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
            {matched.isolated_shedding_data.explanation}
          </p>

          <div className="pt-2 border-t border-amber-200/60">
            <span className="text-xs font-bold text-amber-900 block mb-1.5">
              Questions to reflect on before seeing a doctor:
            </span>
            <ul className="space-y-1 text-xs text-amber-800 list-disc list-inside">
              {matched.isolated_shedding_data.follow_up_questions_to_ask_yourself.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Card 3: Who to See & Recommended Timing */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-emerald-600" />
          Who to See & Consultation Urgency
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-semibold text-slate-500 block">Suggested Specialist:</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {matched.doctor_specialist}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Qualified to order hormonal blood panels and imaging.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-semibold text-slate-500 block">Guidance Rationale:</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {matched.urgency_reason}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Timely consultation ensures optimal long-term metabolic and ovarian wellness.
            </p>
          </div>
        </div>
      </div>

      {/* Card 4: Tests a Doctor May Suggest */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-600" />
          Tests a Doctor May Suggest
        </h3>
        <p className="text-xs text-slate-500">
          These common clinical assessments evaluate your hormonal, metabolic, or thyroid health:
        </p>

        <div className="space-y-2">
          {matched.tests_suggested.map((test, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex items-start gap-2.5"
            >
              <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <div>
                <span className="font-bold text-slate-900">{test.name}</span>
                <p className="text-slate-600 mt-0.5">{test.purpose}</p>
                {test.note && (
                  <p className="text-[11px] text-purple-700 mt-0.5 italic">{test.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 5: Questions to Ask Your Doctor */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          Questions to Ask Your Doctor
        </h3>
        <p className="text-xs text-slate-500">
          Feel free to copy or print these questions to bring to your consultation:
        </p>

        <div className="space-y-2">
          {matched.questions_to_ask.map((question, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex items-center justify-between gap-3 group"
            >
              <span className="text-slate-800">{question}</span>
              <button
                onClick={() => handleCopyQuestion(question, idx)}
                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                title="Copy question"
              >
                {copiedQuestionIdx === idx ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Card 6: Things to Note Before Your Visit */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-rose-600" />
          Things to Note Before Your Visit
        </h3>
        <ul className="space-y-2 text-xs text-slate-700">
          {matched.things_to_note.map((note, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
