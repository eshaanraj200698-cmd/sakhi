/**
 * SakhiCheck: Deterministic Rotterdam Criteria & Clinical Safety Matcher
 * Strictly non-diagnostic; rules decide patterns while keeping LLM out of condition logic.
 */

import { db } from './db.ts';
import {
  ExtractionResult,
  MatchedResult,
  RotterdamEvaluation,
  SurfacedCondition,
  RedFlag,
  DiagnosticTest,
  ExtractedSymptom
} from './types.ts';

export function evaluateSymptoms(extraction: ExtractionResult): MatchedResult {
  const redFlagsList = db.getRedFlags();
  const allConditions = db.getConditions();
  const allCarePathways = db.getCarePathways();

  // 1. Red Flag Safety Check (Escalate immediately, skip PCOS analysis)
  const activeRedFlags: RedFlag[] = [];
  if (extraction.red_flags && extraction.red_flags.length > 0) {
    for (const rfKey of extraction.red_flags) {
      const found = redFlagsList.find((r) => r.key === rfKey);
      if (found && !activeRedFlags.some((a) => a.key === found.key)) {
        activeRedFlags.push(found);
      }
    }
  }

  if (activeRedFlags.length > 0) {
    const primaryRf = activeRedFlags[0];
    return {
      red_flag_triggered: true,
      active_red_flags: activeRedFlags,
      is_unrelated: false,
      urgency: 'urgent',
      urgency_reason: primaryRf.label,
      doctor_specialist: 'Emergency Department / Immediate Gynecological Care',
      tests_suggested: [
        {
          name: 'Immediate Clinical & Hemodynamic Assessment',
          purpose: 'Assess blood pressure, pulse, hemoglobin, and acute pelvic pain sources.'
        },
        {
          name: 'Stat Pelvic Ultrasound or Beta-hCG (if pregnancy possible)',
          purpose: 'Rule out ectopic pregnancy, ovarian torsion, or severe hemorrhage.'
        }
      ],
      questions_to_ask: [
        'How many sanitary pads or tampons have I soaked in the past 2 to 4 hours?',
        'Is there any chance of an early pregnancy?',
        'Do I need intravenous fluids or medication to control the bleeding?'
      ],
      things_to_note: [
        'Do not drive yourself if you are feeling dizzy or weak; seek transport assistance.',
        'Keep any sanitary products to help doctors assess blood loss.'
      ],
      extracted_symptoms: extraction.matched_keys,
      isolated_shedding_case: false,
      surfaced_conditions: [],
      plain_explanation: primaryRf.message[extraction.user_language === 'kn' ? 'kn' : extraction.user_language === 'hi' || extraction.user_language === 'hinglish' ? 'hi' : 'en'],
      generation_source: extraction.source
    };
  }

  const matchedKeySet = new Set(extraction.matched_keys.map((k) => k.key));

  // Decorate symptoms with display labels
  const decoratedSymptoms: ExtractedSymptom[] = extraction.matched_keys.map((s) => {
    const symObj = db.getSymptomByKey(s.key);
    return {
      ...s,
      label_display: symObj ? symObj.label_en : s.key.replace(/_/g, ' ')
    };
  });

  // 2. Unrelated Symptoms Check
  const hasOnlyUnrelated =
    matchedKeySet.size === 1 && matchedKeySet.has('unrelated_symptom');
  const hasNoSymptoms = matchedKeySet.size === 0 && extraction.cycle_pattern === 'unknown';

  if (hasOnlyUnrelated || (hasNoSymptoms && !activeRedFlags.length)) {
    return {
      red_flag_triggered: false,
      active_red_flags: [],
      is_unrelated: true,
      unrelated_message: 'These don’t seem related to hormonal health.',
      urgency: 'routine',
      urgency_reason: 'Non-hormonal symptom reported',
      doctor_specialist: 'General Physician / Primary Care Practitioner',
      tests_suggested: [
        {
          name: 'General Clinical Examination',
          purpose: 'Routine assessment with a primary care doctor.'
        }
      ],
      questions_to_ask: [
        'What could be the cause of what I am experiencing?',
        'Do you recommend any basic routine evaluation?'
      ],
      things_to_note: [
        'Note when this started and what makes it better or worse.'
      ],
      extracted_symptoms: decoratedSymptoms,
      isolated_shedding_case: false,
      surfaced_conditions: [],
      plain_explanation: 'These don’t seem related to hormonal health.',
      generation_source: extraction.source
    };
  }

  // 3. Rotterdam Criteria Evaluation (PCOS Pattern Logic)
  // Criterion 1: Ovulatory dysfunction
  // Bug 2 Rule: Denial respected. If cycle_pattern === 'regular' or 'unknown', criterion NEVER fires!
  const ovulatoryCycleIssues: ('irregular' | 'absent' | 'very_long' | 'very_frequent')[] = [
    'irregular',
    'absent',
    'very_long',
    'very_frequent'
  ];
  const isOvulatoryCriterionMet =
    ovulatoryCycleIssues.includes(extraction.cycle_pattern as any) ||
    (matchedKeySet.has('irregular_cycles') && extraction.cycle_pattern !== 'regular') ||
    (matchedKeySet.has('absent_cycles') && extraction.cycle_pattern !== 'regular');

  const ovulatoryStatus =
    extraction.cycle_pattern === 'regular'
      ? 'reported_regular'
      : isOvulatoryCriterionMet
      ? 'reported_irregular'
      : 'not_reported';

  const ovulatoryEvidence =
    extraction.cycle_pattern === 'regular'
      ? 'Self-reported as regular / normal'
      : matchedKeySet.has('absent_cycles')
      ? extraction.matched_keys.find((k) => k.key === 'absent_cycles')?.evidence || 'Missed periods'
      : extraction.matched_keys.find((k) => k.key === 'irregular_cycles')?.evidence || (extraction.cycle_pattern !== 'unknown' ? `Cycle pattern: ${extraction.cycle_pattern}` : undefined);

  // Criterion 2: Hyperandrogenism
  // Bug 3 Rule: Strong signs: facial_hair_hirsutism, acne_cystic, hair_thinning_pattern.
  // hair_shedding_general alone is weak and DOES NOT trigger androgen criterion unless combined with strong signs or irregular cycles!
  const strongAndrogenKeys = ['facial_hair_hirsutism', 'acne_cystic', 'hair_thinning_pattern'];
  const reportedStrongAndrogens = strongAndrogenKeys.filter((k) => matchedKeySet.has(k));
  const hasGeneralShedding = matchedKeySet.has('hair_shedding_general');

  let androgenStatus: 'reported_signs' | 'weak_or_isolated_shedding' | 'not_reported' = 'not_reported';
  const androgenFeatures: string[] = [];

  for (const k of reportedStrongAndrogens) {
    const symObj = db.getSymptomByKey(k);
    if (symObj) androgenFeatures.push(symObj.label_en);
  }

  if (reportedStrongAndrogens.length > 0) {
    androgenStatus = 'reported_signs';
    if (hasGeneralShedding) {
      androgenFeatures.push('Diffuse hair shedding (in addition to androgen signs)');
    }
  } else if (hasGeneralShedding) {
    if (isOvulatoryCriterionMet) {
      // General shedding combined with irregular cycles
      androgenStatus = 'weak_or_isolated_shedding';
      androgenFeatures.push('Hair shedding (evaluated in context of cycle irregularity)');
    } else {
      // Isolated hair shedding with normal or unstated periods
      androgenStatus = 'weak_or_isolated_shedding';
      androgenFeatures.push('Hair shedding (isolated, non-specific; does not meet Rotterdam androgen threshold on its own)');
    }
  }

  // Count self-reportable Rotterdam categories (out of 2 self-reportable clinical pillars)
  let rotterdamCategoryCount = 0;
  if (isOvulatoryCriterionMet) rotterdamCategoryCount += 1;
  if (androgenStatus === 'reported_signs') rotterdamCategoryCount += 1;

  let statusLabel: 'aligns_with_pattern' | 'isolated_sign' | 'insufficient_evidence' | 'not_indicated' = 'not_indicated';
  if (rotterdamCategoryCount >= 2) {
    statusLabel = 'aligns_with_pattern';
  } else if (rotterdamCategoryCount === 1 || (isOvulatoryCriterionMet && hasGeneralShedding)) {
    statusLabel = 'isolated_sign';
  } else if (androgenStatus === 'weak_or_isolated_shedding' || matchedKeySet.size > 0) {
    statusLabel = 'insufficient_evidence';
  }

  const rotterdamEvaluation: RotterdamEvaluation = {
    ovulatory_status: ovulatoryStatus,
    ovulatory_evidence: ovulatoryEvidence,
    androgen_status: androgenStatus,
    androgen_features: androgenFeatures,
    ultrasound_status: 'requires_clinical_scan',
    ultrasound_note:
      'Requires a pelvic ultrasound (transvaginal or transabdominal) by a licensed radiologist or sonographer. Cannot be self-reported.',
    rotterdam_category_count: rotterdamCategoryCount,
    status_label: statusLabel
  };

  // 4. Check for Isolated Hair Shedding Case (Bug 3)
  const isIsolatedSheddingCase =
    hasGeneralShedding &&
    reportedStrongAndrogens.length === 0 &&
    !isOvulatoryCriterionMet;

  // 5. Differential Conditions Surfacing
  const surfacedConditions: SurfacedCondition[] = [];

  // PCOS Condition
  const pcosCondition = allConditions.find((c) => c.key === 'pcos');
  const pcosPathway = allCarePathways.find((p) => p.condition_key === 'pcos');

  if (pcosCondition && (statusLabel === 'aligns_with_pattern' || statusLabel === 'isolated_sign')) {
    surfacedConditions.push({
      condition: pcosCondition,
      reason:
        statusLabel === 'aligns_with_pattern'
          ? 'Your described experiences (cycle pattern + androgen features) align with 2 self-reportable clinical pillars of the Rotterdam framework. A doctor also looks at ultrasound and blood panels.'
          : 'You reported an isolated feature (such as cycle changes or skin/hair signs) that is frequently evaluated when checking for PCOS and other hormonal patterns.',
      confidence: statusLabel === 'aligns_with_pattern' ? 'high' : 'moderate',
      pathway: pcosPathway
    });
  }

  // Thyroid Condition Check: fatigue + cold intolerance OR fatigue + weight changes
  const thyroidCondition = allConditions.find((c) => c.key === 'thyroid_disorders');
  const thyroidPathway = allCarePathways.find((p) => p.condition_key === 'thyroid_disorders');
  const hasThyroidSigns =
    (matchedKeySet.has('cold_intolerance') && matchedKeySet.has('fatigue_exhaustion')) ||
    (matchedKeySet.has('cold_intolerance') && extraction.cycle_pattern === 'regular') ||
    (matchedKeySet.has('fatigue_exhaustion') && matchedKeySet.has('weight_changes_gain') && extraction.cycle_pattern === 'regular');

  if (thyroidCondition && (hasThyroidSigns || matchedKeySet.has('cold_intolerance'))) {
    surfacedConditions.push({
      condition: thyroidCondition,
      reason:
        'Fatigue, sensitivity to cold, and weight changes are classic symptoms seen in thyroid variations (such as hypothyroidism), which often overlap with or mimic reproductive symptoms.',
      confidence: hasThyroidSigns ? 'high' : 'moderate',
      pathway: thyroidPathway
    });
  }

  // Isolated Hair Shedding / Scalp Condition
  const sheddingCondition = allConditions.find((c) => c.key === 'isolated_hair_shedding');
  const sheddingPathway = allCarePathways.find((p) => p.condition_key === 'isolated_hair_shedding');

  if (isIsolatedSheddingCase && sheddingCondition) {
    surfacedConditions.push({
      condition: sheddingCondition,
      reason:
        'Hair shedding without cycle irregularities or coarse facial hair has many common non-hormonal causes, including scalp conditions like dandruff, nutritional deficits (iron/vitamin D), stress, or recent illness.',
      confidence: 'high',
      pathway: sheddingPathway
    });
  }

  // Primary Care Pathway & Doctor Specialist Selection
  let primaryPathway = pcosPathway;
  let doctorSpecialist = 'Gynecologist or Reproductive Endocrinologist';
  let urgency: 'urgent' | 'soon' | 'routine' = 'routine';
  let urgencyReason = 'Routine health consultation recommended';

  if (isIsolatedSheddingCase) {
    primaryPathway = sheddingPathway;
    doctorSpecialist = 'General Physician or Dermatologist';
    urgency = 'routine';
    urgencyReason = 'Hair shedding with regular cycles is suitable for routine dermatologist or primary doctor consultation';
  } else if (hasThyroidSigns && statusLabel !== 'aligns_with_pattern') {
    primaryPathway = thyroidPathway;
    doctorSpecialist = 'General Physician or Endocrinologist';
    urgency = 'routine';
    urgencyReason = 'Primary care blood panel for thyroid markers recommended';
  } else if (extraction.cycle_pattern === 'absent' || (extraction.cycle_gap_months_approx && extraction.cycle_gap_months_approx >= 3)) {
    urgency = 'soon';
    urgencyReason = 'Periods absent for 3 or more months warrant medical evaluation to protect the uterine lining';
  } else if (statusLabel === 'aligns_with_pattern') {
    urgency = 'soon';
    urgencyReason = 'Multiple hormonal signs present; prompt consultation aids timely management';
  }

  // Aggregate Suggested Tests
  const testsSuggested: DiagnosticTest[] = [];
  if (primaryPathway && primaryPathway.tests) {
    testsSuggested.push(...primaryPathway.tests.slice(0, 4));
  }
  // Ensure pelvic ultrasound is present whenever PCOS is considered
  if (statusLabel === 'aligns_with_pattern' || statusLabel === 'isolated_sign') {
    if (!testsSuggested.some((t) => t.name.toLowerCase().includes('ultrasound'))) {
      testsSuggested.unshift({
        name: 'Pelvic Ultrasound (Transvaginal / Transabdominal)',
        purpose: 'Checks ovarian follicle count and ovarian morphology (Rotterdam 3rd pillar).',
        note: 'Orderable only by your doctor; cannot be self-reported.'
      });
    }
  }

  // Aggregate Questions to Ask
  const questionsToAsk = primaryPathway?.questions_for_doctor || [
    'What tests would help understand if my symptoms are hormonal or metabolic?',
    'Could lifestyle, nutrition, or stress be contributing to these signs?'
  ];

  // Aggregate Things to Note Before Visit
  const thingsToNote = primaryPathway?.preparation_tips || [
    'Note the first day of your last 3-6 menstrual periods.',
    'List all supplements, teas, or medications you take regularly.'
  ];

  return {
    red_flag_triggered: false,
    active_red_flags: [],
    is_unrelated: false,
    pcos_rotterdam: rotterdamEvaluation,
    surfaced_conditions: surfacedConditions,
    care_pathway: primaryPathway,
    isolated_shedding_case: isIsolatedSheddingCase,
    isolated_shedding_data: sheddingPathway?.isolated_shedding_guidance,
    urgency,
    urgency_reason: urgencyReason,
    doctor_specialist: doctorSpecialist,
    tests_suggested: testsSuggested,
    questions_to_ask: questionsToAsk,
    things_to_note: thingsToNote,
    extracted_symptoms: decoratedSymptoms,
    generation_source: extraction.source
  };
}
