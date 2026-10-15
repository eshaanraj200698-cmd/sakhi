import React from 'react';
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { MatchedResult, ExtractionResult } from '../types.ts';

interface DoctorSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  matched: MatchedResult;
  extraction: ExtractionResult;
}

export const DoctorSummaryModal: React.FC<DoctorSummaryModalProps> = ({
  isOpen,
  onClose,
  matched,
  extraction
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 print:max-w-none print:shadow-none print:border-none print:m-0 print:p-0">
        {/* Modal Controls (hidden on print) */}
        <div className="sticky top-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-slate-900">Doctor-Visit Discussion Summary</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="p-8 print:p-6 space-y-6 text-slate-800 text-sm">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">SakhiCheck Health Brief</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Patient-Prepared Clinical Discussion Summary • Generated on {currentDate}
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="font-semibold text-slate-700">Specialist Recommendation:</span>
              <p className="text-rose-700 font-bold">{matched.doctor_specialist}</p>
            </div>
          </div>

          {/* Educational Disclaimer */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 italic">
            Note for Physician: This brief was organized by the patient using SakhiCheck (an educational tool based on Rotterdam 2004/2023 international PCOS criteria) to facilitate clear communication of regional-language symptom descriptions. It is strictly non-diagnostic.
          </div>

          {/* Patient's Own Words */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              1. Patient's Reported Description
            </h3>
            <div className="p-3.5 bg-rose-50/50 rounded-lg border border-rose-100 text-slate-800 italic text-sm">
              "{extraction.raw_text}"
            </div>
          </div>

          {/* Structured Findings */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              2. Documented Symptom Evidence
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <span className="font-semibold text-slate-700 block">Menstrual Cycle Pattern:</span>
                <span className="capitalize font-medium text-slate-900">
                  {extraction.cycle_pattern === 'absent'
                    ? `Amenorrhea / Absent (~${extraction.cycle_gap_months_approx || 3} months)`
                    : extraction.cycle_pattern}
                </span>
                {matched.pcos_rotterdam?.ovulatory_evidence && (
                  <p className="text-slate-500 mt-1 text-[11px]">
                    Quoted phrase: "{matched.pcos_rotterdam.ovulatory_evidence}"
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <span className="font-semibold text-slate-700 block">Hyperandrogenism / Physical Signs:</span>
                {matched.pcos_rotterdam?.androgen_features && matched.pcos_rotterdam.androgen_features.length > 0 ? (
                  <ul className="list-disc list-inside text-slate-900 font-medium">
                    {matched.pcos_rotterdam.androgen_features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-500">None self-reported</span>
                )}
              </div>
            </div>
          </div>

          {/* Rotterdam Evaluation Pillar Breakdown */}
          {matched.pcos_rotterdam && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                3. Rotterdam Consensus Evaluation (2 of 3 Criteria Required)
              </h3>
              <div className="space-y-2 border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-medium text-slate-800">
                    Criterion 1: Ovulatory / Menstrual Irregularity
                  </span>
                  <span
                    className={`font-semibold ${
                      matched.pcos_rotterdam.ovulatory_status === 'reported_irregular'
                        ? 'text-rose-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {matched.pcos_rotterdam.ovulatory_status === 'reported_irregular'
                      ? 'Indicated by self-report'
                      : matched.pcos_rotterdam.ovulatory_status === 'reported_regular'
                      ? 'Self-reported Regular'
                      : 'Not reported'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-medium text-slate-800">
                    Criterion 2: Clinical or Biochemical Hyperandrogenism
                  </span>
                  <span
                    className={`font-semibold ${
                      matched.pcos_rotterdam.androgen_status === 'reported_signs'
                        ? 'text-rose-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {matched.pcos_rotterdam.androgen_status === 'reported_signs'
                      ? 'Indicated by self-report'
                      : matched.pcos_rotterdam.androgen_status === 'weak_or_isolated_shedding'
                      ? 'Isolated diffuse shedding only'
                      : 'Not reported'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-medium text-slate-800">
                    Criterion 3: Polycystic Ovarian Morphology
                  </span>
                  <span className="font-semibold text-slate-500">Requires Pelvic Ultrasound</span>
                </div>
              </div>
            </div>
          )}

          {/* Suggested Lab / Imaging Evaluations */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              4. Standard Clinical Assessments to Discuss
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {matched.tests_suggested.map((t, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>{t.name}:</strong> {t.purpose}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Questions to Discuss */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              5. Patient Questions for the Doctor
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700">
              {matched.questions_to_ask.map((q, idx) => (
                <li key={idx}>{q}</li>
              ))}
            </ol>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex justify-between text-[11px] text-slate-400">
            <span>SakhiCheck Educational Summary</span>
            <span>Always consult a certified medical professional</span>
          </div>
        </div>
      </div>
    </div>
  );
};
