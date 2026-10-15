/**
 * SakhiCheck: Test Suite for Rotterdam Criteria & Clinical Logic
 * Validates all required test cases from the project handoff
 */

import { fuzzyExtractSymptoms, detectRawRedFlags } from '../fuzzyMatcher.ts';
import { evaluateSymptoms } from '../matcher.ts';

interface TestCase {
  name: string;
  input: string;
  check: (res: ReturnType<typeof evaluateSymptoms>, extraction: ReturnType<typeof fuzzyExtractSymptoms>) => boolean;
  expectedDescription: string;
}

const testCases: TestCase[] = [
  {
    name: 'Test 1: Classic PCOS presentation',
    input: 'My periods come every 2-3 months, I have a lot of acne and facial hair',
    expectedDescription: 'Irregular cycle + androgen signs; PCOS pattern surfaces ("aligns with")',
    check: (res) => {
      return (
        !res.red_flag_triggered &&
        res.pcos_rotterdam?.status_label === 'aligns_with_pattern' &&
        res.pcos_rotterdam?.rotterdam_category_count === 2 &&
        res.surfaced_conditions.some((c) => c.condition.key === 'pcos')
      );
    }
  },
  {
    name: 'Test 2: Romanized Hindi absent cycle',
    input: 'mujhe 3 mahine se period nahi aaya aur baal jhad rahe hain',
    expectedDescription: 'Absent cycle (about 3 months) + hair shedding noted',
    check: (res, ext) => {
      return (
        !res.red_flag_triggered &&
        ext.cycle_pattern === 'absent' &&
        (ext.cycle_gap_months_approx ?? 3) >= 2.5 &&
        ext.matched_keys.some((k) => k.key === 'hair_shedding_general' || k.key === 'absent_cycles')
      );
    }
  },
  {
    name: 'Test 3: Kannada input (irregular periods + weight gain)',
    input: 'ನನಗೆ ಅನಿಯಮಿತ ಮುಟ್ಟು ಮತ್ತು ತೂಕ ಹೆಚ್ಚಾಗುವಿಕೆ ಸಮಸ್ಯೆ ಇದೆ',
    expectedDescription: 'Cycle criterion fires; no androgen signs; ultrasound line present',
    check: (res) => {
      const hasUltrasound = Boolean(res.pcos_rotterdam?.ultrasound_note);
      return (
        !res.red_flag_triggered &&
        res.pcos_rotterdam?.ovulatory_status === 'reported_irregular' &&
        res.pcos_rotterdam?.androgen_status === 'not_reported' &&
        hasUltrasound
      );
    }
  },
  {
    name: 'Test 4: Red flag emergency',
    input: "I'm soaking a pad every hour and feeling dizzy",
    expectedDescription: 'Red flag fires, urgent card, NO PCOS analysis',
    check: (res) => {
      return (
        res.red_flag_triggered &&
        res.urgency === 'urgent' &&
        res.surfaced_conditions.length === 0 &&
        res.active_red_flags.some((r) => r.key === 'excessive_hemorrhage')
      );
    }
  },
  {
    name: 'Test 5: Unrelated symptom',
    input: 'My knee hurts when I run',
    expectedDescription: 'Unrelated; suggest general physician; no forced match',
    check: (res) => {
      return (
        res.is_unrelated &&
        res.surfaced_conditions.length === 0 &&
        res.doctor_specialist.includes('Physician')
      );
    }
  },
  {
    name: 'Test 6: Thyroid differential presentation',
    input: 'Periods regular, tired, feeling cold all the time',
    expectedDescription: 'Thyroid surfaces, not only PCOS',
    check: (res) => {
      return (
        !res.red_flag_triggered &&
        res.surfaced_conditions.some((c) => c.condition.key === 'thyroid_disorders') &&
        res.pcos_rotterdam?.status_label !== 'aligns_with_pattern'
      );
    }
  },
  {
    name: 'Test 7: Denial of cycle irregularity with shedding (Bug 2 & 3)',
    input: 'mere periods toh normal hain but mere baal bohot jhadte hain nahate time',
    expectedDescription: 'No cycle flag, no PCOS pattern, many-causes guidance',
    check: (res, ext) => {
      return (
        !res.red_flag_triggered &&
        ext.cycle_pattern === 'regular' &&
        res.pcos_rotterdam?.status_label !== 'aligns_with_pattern' &&
        res.isolated_shedding_case === true
      );
    }
  },
  {
    name: 'Test 8: Shedding with irregular cycles',
    input: 'periods irregular and hair shedding',
    expectedDescription: 'Shedding linked with irregular cycles',
    check: (res) => {
      return (
        !res.red_flag_triggered &&
        res.pcos_rotterdam?.ovulatory_status === 'reported_irregular' &&
        res.extracted_symptoms.some((s) => s.key === 'hair_shedding_general')
      );
    }
  },
  {
    name: 'Test 9: Regular periods, hair shedding, dandruff',
    input: 'mere periods regular hain, baal jhad rahe hain, dandruff bhi hai',
    expectedDescription: 'Dandruff recognized as possible explanation; isolated shedding',
    check: (res) => {
      return (
        !res.red_flag_triggered &&
        res.isolated_shedding_case === true &&
        res.extracted_symptoms.some((s) => s.key === 'scalp_dandruff_itching')
      );
    }
  },
  {
    name: 'Test 10: Typo tolerance',
    input: 'mensturation irregulr and acn',
    expectedDescription: 'Extracted correctly despite typos',
    check: (_res, ext) => {
      const keys = ext.matched_keys.map((k) => k.key);
      return keys.includes('irregular_cycles') && keys.includes('acne_cystic');
    }
  },
  {
    name: 'Test 11: Mood swings and facial hair',
    input: 'mood swings aur facial hair',
    expectedDescription: 'mood_changes + hirsutism extracted',
    check: (_res, ext) => {
      const keys = ext.matched_keys.map((k) => k.key);
      return keys.includes('mood_changes') && keys.includes('facial_hair_hirsutism');
    }
  }
];

export function runMatcherTests(): { total: number; passed: number; results: any[] } {
  const results = [];
  let passed = 0;

  for (const tc of testCases) {
    const extraction = fuzzyExtractSymptoms(tc.input);
    const evaluation = evaluateSymptoms(extraction);
    const ok = tc.check(evaluation, extraction);
    if (ok) passed++;
    results.push({
      name: tc.name,
      input: tc.input,
      passed: ok,
      expected: tc.expectedDescription,
      cycle_pattern: extraction.cycle_pattern,
      matched_keys: extraction.matched_keys.map((k) => k.key),
      rotterdam_status: evaluation.pcos_rotterdam?.status_label,
      red_flag: evaluation.red_flag_triggered,
      isolated_shedding: evaluation.isolated_shedding_case
    });
  }

  return {
    total: testCases.length,
    passed,
    results
  };
}

// If executed via node / tsx
if (process.argv[1] && process.argv[1].endsWith('matcher.test.ts')) {
  console.log('--- RUNNING SAKHICHECK MATCHER TESTS ---');
  const summary = runMatcherTests();
  for (const r of summary.results) {
    console.log(`${r.passed ? 'PASS' : 'FAIL'}: ${r.name}`);
    if (!r.passed) {
      console.log('   Expected:', r.expected);
      console.log('   Got:', r);
    }
  }
  console.log(`\nResults: ${summary.passed}/${summary.total} passed`);
}
