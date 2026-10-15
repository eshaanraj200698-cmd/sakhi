/**
 * SakhiCheck: Domain & Clinical Architecture Types
 * Rotterdam criteria-based, educational & non-diagnostic
 */

export type LanguageCode = 'en' | 'hi' | 'kn' | 'hinglish' | 'kanglish';

export interface SymptomSynonyms {
  en: string[];
  hi: string[];
  kn: string[];
}

export interface Symptom {
  _id: string;
  key: string;
  label_en: string;
  category: 'menstrual' | 'androgen' | 'hair_scalp' | 'metabolic' | 'systemic' | 'endocrine' | 'wellbeing' | 'general';
  rotterdam_category: 'ovulatory_dysfunction' | 'hyperandrogenism' | null;
  description: string;
  synonyms: SymptomSynonyms;
  linked_conditions: string[];
}

export interface ConditionCriterion {
  id: string;
  name: string;
  description: string;
  self_reportable: boolean;
}

export interface Condition {
  _id: string;
  key: string;
  name: string;
  summary_simple: string;
  criteria: ConditionCriterion[];
  related_symptoms: string[];
  when_to_see_doctor: string;
  sources: string[];
}

export interface RedFlag {
  _id: string;
  key: string;
  label: string;
  pattern_keywords: {
    en: string[];
    hi: string[];
    kn: string[];
  };
  message: {
    en: string;
    hi: string;
    kn: string;
  };
  action: string;
}

export interface DiagnosticTest {
  name: string;
  purpose: string;
  note?: string;
}

export interface UrgencyRule {
  level: 'urgent' | 'soon' | 'routine';
  condition: string;
  recommendation: string;
}

export interface IsolatedSheddingGuidance {
  explanation: string;
  suggested_specialist: string;
  follow_up_questions_to_ask_yourself: string[];
}

export interface CarePathway {
  _id: string;
  condition_key: string;
  specialist: string;
  summary: string;
  tests: DiagnosticTest[];
  urgency_rules: UrgencyRule[];
  questions_for_doctor: string[];
  preparation_tips?: string[];
  isolated_shedding_guidance?: IsolatedSheddingGuidance;
}

export interface ExtractedSymptom {
  key: string;
  evidence: string;
  confidence_note?: string;
  label_display?: string;
}

export type CyclePattern = 'regular' | 'irregular' | 'absent' | 'very_long' | 'very_frequent' | 'unknown';

export interface ExtractionResult {
  matched_keys: ExtractedSymptom[];
  cycle_pattern: CyclePattern;
  cycle_gap_months_approx?: number | null;
  red_flags: string[];
  missing_info: string[];
  user_language: LanguageCode;
  denials: string[];
  raw_text: string;
  source: 'gemini' | 'fuzzy_fallback';
}

export interface RotterdamEvaluation {
  ovulatory_status: 'reported_irregular' | 'reported_regular' | 'not_reported';
  ovulatory_evidence?: string;
  androgen_status: 'reported_signs' | 'weak_or_isolated_shedding' | 'not_reported';
  androgen_features: string[];
  ultrasound_status: 'requires_clinical_scan';
  ultrasound_note: string;
  rotterdam_category_count: number; // e.g. 1 or 2 (clinical criteria)
  status_label: 'aligns_with_pattern' | 'isolated_sign' | 'insufficient_evidence' | 'not_indicated';
}

export interface SurfacedCondition {
  condition: Condition;
  reason: string;
  confidence: 'high' | 'moderate' | 'low' | 'informational';
  pathway?: CarePathway;
}

export interface MatchedResult {
  red_flag_triggered: boolean;
  active_red_flags: RedFlag[];
  is_unrelated: boolean;
  unrelated_message?: string;
  pcos_rotterdam?: RotterdamEvaluation;
  surfaced_conditions: SurfacedCondition[];
  care_pathway?: CarePathway;
  isolated_shedding_case: boolean;
  isolated_shedding_data?: IsolatedSheddingGuidance;
  urgency: 'urgent' | 'soon' | 'routine';
  urgency_reason: string;
  doctor_specialist: string;
  tests_suggested: DiagnosticTest[];
  questions_to_ask: string[];
  things_to_note: string[];
  extracted_symptoms: ExtractedSymptom[];
  plain_explanation?: string;
  generation_source: 'gemini' | 'fuzzy_fallback';
}

export interface SessionHistoryItem {
  _id: string;
  created_at: string;
  input_text: string;
  language: LanguageCode;
  symptoms_summary: string[];
  urgency: 'urgent' | 'soon' | 'routine';
  pattern_summary: string;
  doctor_type: string;
}
