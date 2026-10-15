/**
 * SakhiCheck: Robust Deterministic Fuzzy Fallback Matcher
 * Uses Fuse.js + regional normalization (Hindi/Kannada/English)
 */

import Fuse from 'fuse.js';
import { db } from './db.ts';
import { ExtractedSymptom, ExtractionResult, CyclePattern } from './types.ts';

// Voice transcript normalizer
export function normaliseVoiceTranscript(text: string): string {
  let cleaned = text;

  // Normalize smart quotes
  cleaned = cleaned.replace(/[\u201C\u201D"']/g, '');

  // Remove repeated conversational fillers like "Yes.. Yes.", "uh uh", "um"
  cleaned = cleaned.replace(/\b(yes|yeah|yep|uh|um|hmm|ha|haa)(?:\W+\1)+\b/gi, '');

  // Connect words separated by misplaced periods: "having. period" -> "having period"
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)\.\s+([a-zA-Z0-9]+)/g, '$1 $2');
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)\.\s+([a-zA-Z0-9]+)/g, '$1 $2');

  // Remove standalone filler tokens like "Yes" at the end
  cleaned = cleaned.replace(/(?:^|\s)(?:yes|yeah|yep|uh|um)\.?\s*$/gi, '');

  // Collapse multiple dots / spaces
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\s*\.\s*/g, '. ').trim();
  cleaned = cleaned.replace(/^[.\s]+|[.\s]+$/g, '').trim();

  return cleaned;
}

// Text Normalizer for Hinglish, Kanglish, and English
export function normalizeText(text: string): string {
  let lower = text.toLowerCase();

  // Normalize punctuation to spaces
  lower = lower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ');

  // Collapse repeated characters (e.g. "bohooot" -> "bohot", "irregulrrr" -> "irregular", "naaaahi" -> "nahi")
  lower = lower.replace(/(.)\1{2,}/g, '$1$1');

  // Spelling variant normalization
  const variants: [RegExp, string][] = [
    [/\b(nahin|nai|nahi|naahi|nhi)\b/g, 'nahi'],
    [/\b(bohot|bahut|bhut|bhot|thodaa|jyada|zyada)\b/g, 'bohot'],
    [/\b(irregulr|irreguler|iregular|unregular)\b/g, 'irregular'],
    [/\b(mensturation|menstuation|manstration|menses)\b/g, 'menstruation'],
    [/\b(acn|akne)\b/g, 'acne'],
    [/\b(baal|koodalu|hair)\s+(jhadna|girna|fall|uduruvudu|jhadte|jhad rahe|udurthide)\b/g, 'hair fall'],
    [/\b(chin|thodi|mukhada|chehre)\s+(par|mele|hair|koodalu)\b/g, 'facial hair'],
    [/\b(pimples|pimple|acne|daane|modave|modavegalu)\b/g, 'acne'],
    [/\b(hottu|rusi|khujli|dandruff)\b/g, 'dandruff']
  ];

  for (const [pattern, replacement] of variants) {
    lower = lower.replace(pattern, replacement);
  }

  return lower.replace(/\s+/g, ' ').trim();
}

interface SynonymIndexItem {
  key: string;
  synonym: string;
  lang: 'en' | 'hi' | 'kn';
  category: string;
  rotterdam_category: string | null;
}

// Build searchable synonym flat list for Fuse.js
function buildSynonymIndex(): SynonymIndexItem[] {
  const symptoms = db.getSymptoms();
  const list: SynonymIndexItem[] = [];

  for (const sym of symptoms) {
    for (const enSyn of sym.synonyms.en || []) {
      list.push({
        key: sym.key,
        synonym: normalizeText(enSyn),
        lang: 'en',
        category: sym.category,
        rotterdam_category: sym.rotterdam_category
      });
    }
    for (const hiSyn of sym.synonyms.hi || []) {
      list.push({
        key: sym.key,
        synonym: normalizeText(hiSyn),
        lang: 'hi',
        category: sym.category,
        rotterdam_category: sym.rotterdam_category
      });
    }
    for (const knSyn of sym.synonyms.kn || []) {
      list.push({
        key: sym.key,
        synonym: normalizeText(knSyn),
        lang: 'kn',
        category: sym.category,
        rotterdam_category: sym.rotterdam_category
      });
    }
  }

  return list;
}

const synonymIndex = buildSynonymIndex();
const fuse = new Fuse(synonymIndex, {
  keys: ['synonym'],
  threshold: 0.35,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 3
});

// Check for direct red flags on raw text
export function detectRawRedFlags(rawText: string): string[] {
  const norm = normalizeText(rawText);
  const redFlags = db.getRedFlags();
  const triggered: string[] = [];

  for (const rf of redFlags) {
    let matched = false;
    const allKeywords = [
      ...(rf.pattern_keywords.en || []),
      ...(rf.pattern_keywords.hi || []),
      ...(rf.pattern_keywords.kn || [])
    ];

    for (const kw of allKeywords) {
      const normKw = normalizeText(kw);
      if (norm.includes(normKw)) {
        matched = true;
        break;
      }
    }

    // Specific phrase checks
    if (!matched) {
      if (
        rf.key === 'excessive_hemorrhage' &&
        (norm.includes('soaking a pad') ||
          norm.includes('pad every hour') ||
          (norm.includes('pad') && norm.includes('hour')) ||
          norm.includes('har ghante pad') ||
          (norm.includes('bleeding') && norm.includes('dizzy')))
      ) {
        matched = true;
      } else if (
        rf.key === 'acute_severe_pelvic_pain' &&
        (norm.includes('severe pelvic pain') ||
          norm.includes('unbearable') ||
          norm.includes('stabbing pain'))
      ) {
        matched = true;
      } else if (
        rf.key === 'pregnancy_bleeding_pain' &&
        norm.includes('pregnant') &&
        (norm.includes('bleeding') || norm.includes('pain') || norm.includes('spotting'))
      ) {
        matched = true;
      } else if (
        rf.key === 'fainting_syncope' &&
        (norm.includes('faint') || norm.includes('passed out') || norm.includes('behosh'))
      ) {
        matched = true;
      } else if (
        rf.key === 'self_harm_ideation' &&
        (norm.includes('end my life') || norm.includes('suicide') || norm.includes('kill myself'))
      ) {
        matched = true;
      }
    }

    if (matched && !triggered.includes(rf.key)) {
      triggered.push(rf.key);
    }
  }

  return triggered;
}

// Check cycle denials and affirmations
export function detectCyclePattern(
  normalizedText: string,
  rawText: string
): { pattern: CyclePattern; evidence: string; gapMonths?: number } {
  // Check explicit denials first (Bug 2)
  // "mere periods toh normal hain", "periods regular", "periods are normal", "cycle is normal", "periods sahi hain"
  const regularPhrases = [
    'periods toh normal',
    'periods normal',
    'periods regular',
    'period normal',
    'cycle is normal',
    'periods are normal',
    'regular periods',
    'periods regular hain',
    'period regular',
    'periods are regular',
    'period time pe aate',
    'cycle regular',
    'muttu regular'
  ];

  for (const phrase of regularPhrases) {
    if (normalizedText.includes(phrase)) {
      return { pattern: 'regular', evidence: phrase };
    }
  }

  // Check absent periods (e.g. "3 mahine se period nahi aaya", "haven't had period in 3 months", "no periods for 2 months")
  const absentRegex = /(?:(\d+)\s*(?:months?|mahine?|tingalu?)|three|two|do|teen)\s*(?:se|no|without|se\s+nahi)?\s*(?:period|menses|mahina|muttu)/i;
  const matchAbsent = rawText.match(absentRegex) || rawText.match(/(?:period|mahina|muttu)\s*(?:nahi aaya|band|stopped|missed)/i);
  
  if (
    normalizedText.includes('nahi aaya') ||
    normalizedText.includes('band ho gaye') ||
    normalizedText.includes('missed period') ||
    normalizedText.includes('no period') ||
    normalizedText.includes('bandilla') ||
    matchAbsent
  ) {
    // Check approximate duration
    let gapMonths = 3;
    const digitMatch = rawText.match(/(\d+)\s*(?:month|mahine|tingal)/i);
    if (digitMatch) {
      gapMonths = parseInt(digitMatch[1], 10);
    } else if (rawText.toLowerCase().includes('do teen') || rawText.toLowerCase().includes('2-3')) {
      gapMonths = 2.5;
    }
    return {
      pattern: 'absent',
      evidence: matchAbsent ? matchAbsent[0] : 'missed/absent cycle reported',
      gapMonths
    };
  }

  // Check irregular / delayed cycles
  const irregularPhrases = [
    'every 2 3 months',
    'every 2-3 months',
    'irregular periods',
    'periods irregular',
    'menstruation irregular',
    'irregular menstruation',
    'irregulr',
    'late periods',
    'delayed periods',
    'aage peeche',
    'time pe nahi',
    'ಅನಿಯಮಿತ ಮುಟ್ಟು',
    'ಅನಿಯಮಿತ',
    'ಮುಟ್ಟು ತಡವಾಗಿ',
    'aniyamitha muttu',
    'muttu late',
    'dates change every month',
    'cycle late'
  ];

  for (const phrase of irregularPhrases) {
    if (normalizedText.includes(phrase)) {
      let gap = 2;
      if (normalizedText.includes('2 3') || normalizedText.includes('2-3')) {
        gap = 2.5;
      }
      return { pattern: 'irregular', evidence: phrase, gapMonths: gap };
    }
  }

  // Elliptical phrases referring to periods when "period" or "cramps" is present
  const hasPeriodOrCrampContext =
    normalizedText.includes('period') ||
    normalizedText.includes('cramp') ||
    normalizedText.includes('menses') ||
    normalizedText.includes('mahina') ||
    normalizedText.includes('muttu');

  if (hasPeriodOrCrampContext) {
    if (
      normalizedText.includes('missed a few') ||
      normalizedText.includes('missed few') ||
      normalizedText.includes('skipped') ||
      normalizedText.includes('didnt come') ||
      normalizedText.includes('didn t come')
    ) {
      return {
        pattern: 'irregular',
        evidence: 'missed a few',
        gapMonths: 2
      };
    }
  }

  return { pattern: 'unknown', evidence: '' };
}

// Fallback fuzzy extraction pipeline
export function fuzzyExtractSymptoms(rawText: string): ExtractionResult {
  const cleanedText = normaliseVoiceTranscript(rawText);
  const norm = normalizeText(cleanedText);
  const redFlags = detectRawRedFlags(cleanedText);

  // Cycle pattern
  const cycleInfo = detectCyclePattern(norm, cleanedText);

  const matchedMap = new Map<string, ExtractedSymptom>();
  const denials: string[] = [];

  if (cycleInfo.pattern === 'regular') {
    denials.push('irregular_cycles');
    denials.push('absent_cycles');
  } else if (cycleInfo.pattern === 'absent') {
    matchedMap.set('absent_cycles', {
      key: 'absent_cycles',
      evidence: cycleInfo.evidence || 'missed cycle',
      confidence_note: `Cycle gap approx ${cycleInfo.gapMonths || 3} months`
    });
  } else if (cycleInfo.pattern === 'irregular') {
    matchedMap.set('irregular_cycles', {
      key: 'irregular_cycles',
      evidence: cycleInfo.evidence || 'irregular cycle',
      confidence_note: 'Reported unpredictable or delayed timing'
    });
  }

  // Check for period cramps / period pain
  if (
    norm.includes('cramp') ||
    norm.includes('period cramps') ||
    norm.includes('menstrual cramps') ||
    norm.includes('dysmenorrhea') ||
    norm.includes('period pain') ||
    norm.includes('muttina novu')
  ) {
    matchedMap.set('period_pain', {
      key: 'period_pain',
      evidence: rawText.match(/period\s+cramps?|cramps?/i)?.[0] || 'period cramps',
      confidence_note: 'Menstrual cramping / dysmenorrhea'
    });
  }

  // Check for acne
  if (
    norm.includes('acne') ||
    norm.includes('pimples') ||
    norm.includes('daane') ||
    norm.includes('modave') ||
    norm.includes('ಮೊಡವೆ')
  ) {
    matchedMap.set('acne_cystic', {
      key: 'acne_cystic',
      evidence: 'acne/pimples mentioned',
      confidence_note: 'Cutaneous androgen feature'
    });
  }

  // Check for facial hair / hirsutism
  if (
    norm.includes('facial hair') ||
    norm.includes('chin hair') ||
    norm.includes('chehre par baal') ||
    norm.includes('thodi par baal') ||
    norm.includes('mukhada mele koodalu') ||
    norm.includes('ಮುಖದಲ್ಲಿ ಕೂದಲು') ||
    norm.includes('mustache') ||
    (norm.includes('baal') && (norm.includes('face') || norm.includes('chin') || norm.includes('chehre')))
  ) {
    matchedMap.set('facial_hair_hirsutism', {
      key: 'facial_hair_hirsutism',
      evidence: 'facial hair / chin hair noted',
      confidence_note: 'Excess androgenic hair growth'
    });
  }

  // Check for hair shedding (general vs pattern thinning)
  // Bug 3 check: Pattern thinning vs general shedding
  const hasPatternThinning =
    norm.includes('widening') ||
    norm.includes('maang') ||
    norm.includes('crown') ||
    norm.includes('scalp visible') ||
    norm.includes('baitale') ||
    norm.includes('ಬೈತಲೆ');

  if (hasPatternThinning) {
    matchedMap.set('hair_thinning_pattern', {
      key: 'hair_thinning_pattern',
      evidence: 'crown thinning or widening part',
      confidence_note: 'Androgenetic pattern thinning'
    });
  } else if (
    norm.includes('hair fall') ||
    norm.includes('baal jhad') ||
    norm.includes('shedding') ||
    norm.includes('koodalu udur') ||
    norm.includes('ಕೂದಲು ಉದುರು') ||
    norm.includes('baal bohot jhadte')
  ) {
    matchedMap.set('hair_shedding_general', {
      key: 'hair_shedding_general',
      evidence: 'diffuse hair shedding reported',
      confidence_note: 'General hair fall (weak androgen link alone)'
    });
  }

  // Check for dandruff / scalp itching
  if (
    norm.includes('dandruff') ||
    norm.includes('rusi') ||
    norm.includes('hottu') ||
    norm.includes('ಹೊಟ್ಟು') ||
    norm.includes('khujli') ||
    norm.includes('flaking')
  ) {
    matchedMap.set('scalp_dandruff_itching', {
      key: 'scalp_dandruff_itching',
      evidence: 'dandruff or itchy scalp',
      confidence_note: 'Scalp condition that can cause diffuse shedding'
    });
  }

  // Check for weight gain
  if (
    norm.includes('weight gain') ||
    norm.includes('wazan badh') ||
    norm.includes('tooka') ||
    norm.includes('ತೂಕ') ||
    norm.includes('weight jasti')
  ) {
    matchedMap.set('weight_changes_gain', {
      key: 'weight_changes_gain',
      evidence: 'weight gain reported',
      confidence_note: 'Metabolic correlation'
    });
  }

  // Check for mood swings
  if (
    norm.includes('mood swing') ||
    norm.includes('mood swings') ||
    norm.includes('chidhchidhapan') ||
    norm.includes('kirikiri') ||
    norm.includes('ಮನಸ್ಥಿತಿ') ||
    norm.includes('gussa')
  ) {
    matchedMap.set('mood_changes', {
      key: 'mood_changes',
      evidence: 'mood changes/swings',
      confidence_note: 'Hormonal/wellbeing impact'
    });
  }

  // Check for cold intolerance / fatigue (Thyroid differentials)
  if (norm.includes('cold') || norm.includes('thand lagti') || norm.includes('chali') || norm.includes('ಚಳಿ')) {
    matchedMap.set('cold_intolerance', {
      key: 'cold_intolerance',
      evidence: 'feeling cold constantly',
      confidence_note: 'Metabolic/thyroid differential symptom'
    });
  }
  if (
    norm.includes('tired') ||
    norm.includes('thakan') ||
    norm.includes('susthu') ||
    norm.includes('ಆಯಾಸ') ||
    norm.includes('ಸುಸ್ತು') ||
    norm.includes('fatigue')
  ) {
    matchedMap.set('fatigue_exhaustion', {
      key: 'fatigue_exhaustion',
      evidence: 'fatigue / tiredness',
      confidence_note: 'Systemic energy indicator'
    });
  }

  // Unrelated check: Knee pain, cough, etc.
  if (
    norm.includes('knee') ||
    norm.includes('ghutne') ||
    norm.includes('mandi novu') ||
    norm.includes('ಮಂಡಿ') ||
    norm.includes('tooth')
  ) {
    matchedMap.set('unrelated_symptom', {
      key: 'unrelated_symptom',
      evidence: 'non-hormonal symptom mentioned',
      confidence_note: 'General medical symptom unrelated to endocrine axis'
    });
  }

  // Fallback Fuse search for any remaining matches with stricter threshold
  const tokens = norm.split(' ');
  for (let i = 0; i < tokens.length; i++) {
    const slice = tokens.slice(i, i + 3).join(' ');
    if (slice.length >= 4) {
      const results = fuse.search(slice);
      if (results.length > 0 && results[0].score! < 0.18) {
        const item = results[0].item;
        if (!matchedMap.has(item.key) && !denials.includes(item.key)) {
          matchedMap.set(item.key, {
            key: item.key,
            evidence: slice,
            confidence_note: `Fuzzy matched '${item.synonym}'`
          });
        }
      }
    }
  }

  // Detect user language
  let userLang: 'en' | 'hi' | 'kn' | 'hinglish' | 'kanglish' = 'en';
  if (/[\u0C80-\u0CFF]/.test(rawText)) {
    userLang = 'kn';
  } else if (/[\u0900-\u097F]/.test(rawText)) {
    userLang = 'hi';
  } else if (
    norm.includes('mujhe') ||
    norm.includes('hai') ||
    norm.includes('hain') ||
    norm.includes('nahi') ||
    norm.includes('bohot') ||
    norm.includes('baal') ||
    norm.includes('mahine')
  ) {
    userLang = 'hinglish';
  } else if (
    norm.includes('muttu') ||
    norm.includes('koodalu') ||
    norm.includes('hottu') ||
    norm.includes('agide') ||
    norm.includes('aagthide')
  ) {
    userLang = 'kanglish';
  }

  return {
    matched_keys: Array.from(matchedMap.values()),
    cycle_pattern: cycleInfo.pattern,
    cycle_gap_months_approx: cycleInfo.gapMonths || null,
    red_flags: redFlags,
    missing_info: ['Pelvic ultrasound examination', 'Duration of hair or cycle changes'],
    user_language: userLang,
    denials,
    raw_text: rawText,
    source: 'fuzzy_fallback'
  };
}
