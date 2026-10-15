/**
 * SakhiCheck: Server-side Gemini 3.8 Flash Integration
 * Structured symptom extraction + plain-language empathy explainer
 */

import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../db.ts';
import { fuzzyExtractSymptoms, detectRawRedFlags, normaliseVoiceTranscript } from '../fuzzyMatcher.ts';
import { ExtractionResult, MatchedResult, LanguageCode } from '../types.ts';

// Allowed symptom keys strictly from symptoms.json
const ALLOWED_KEYS = [
  'irregular_cycles',
  'absent_cycles',
  'period_pain',
  'facial_hair_hirsutism',
  'acne_cystic',
  'hair_thinning_pattern',
  'hair_shedding_general',
  'scalp_dandruff_itching',
  'weight_changes_gain',
  'dark_skin_patches',
  'mood_changes',
  'fatigue_exhaustion',
  'cold_intolerance',
  'galactorrhea_discharge',
  'unrelated_symptom'
];

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

export async function extractSymptomsWithGemini(rawText: string): Promise<ExtractionResult> {
  const cleanedText = normaliseVoiceTranscript(rawText);
  const ai = getGenAIClient();
  const rawRedFlags = detectRawRedFlags(cleanedText);

  if (!ai) {
    console.log('[SakhiCheck] GEMINI_API_KEY not provided; using robust fuzzy fallback.');
    const fallback = fuzzyExtractSymptoms(cleanedText);
    for (const rf of rawRedFlags) {
      if (!fallback.red_flags.includes(rf)) fallback.red_flags.push(rf);
    }
    return fallback;
  }

  const systemInstruction = `You are a specialized clinical extraction assistant for SakhiCheck, a women's hormonal health symptom understanding tool.
Your sole job is to parse the user's natural language input (which may be in English, Hindi, Kannada, Hinglish, or Kanglish) and map it onto FIXED symptom keys.

CRITICAL RULES:
1. STRICT KEY RESTRICTION: You MUST ONLY select keys from this exact list:
${ALLOWED_KEYS.map((k) => `"${k}"`).join(', ')}.
DO NOT invent, coin, or modify any keys. If a user describes general joint pain, knee pain, or cold/cough, map it to "unrelated_symptom".
2. EVIDENCE REQUIRED: For EVERY matched key, you MUST provide an "evidence" string quoting the exact words from the user's input. If there are no words in the input supporting a key, DO NOT return that key.
3. RESPECT DENIALS:
- If the user states their periods are normal, regular, or on time ("mere periods normal hain", "periods regular", "periods toh normal hain"), you MUST set "cycle_pattern": "regular", and you MUST NOT return "irregular_cycles" or "absent_cycles".
- List any denied symptoms in "denials".
4. DURATION & ABSENT CYCLES:
- If the user mentions absent periods or missing periods for a duration (e.g., "3 mahine se period nahi aaya", "haven't had period in 3 months", "೩ ತಿಂಗಳು ಮುಟ್ಟು ಬಂದಿಲ್ಲ"), you MUST set "cycle_pattern": "absent", and estimate "cycle_gap_months_approx" as the number of months (e.g. 3).
5. HAIR SHEDDING DISTINCTION:
- If the user describes diffuse hair fall, hair falling in the shower, or combing ("baal jhad rahe hain", "hair fall"), use "hair_shedding_general".
- ONLY use "hair_thinning_pattern" if the user specifically describes crown hair loss, widening of the hair parting line, or visible scalp on top.
6. ELLIPTICAL PHRASES & PERIOD CRAMPS:
- When "period" or "cramps" appears in the text, elliptical phrases like "missed a few", "skipped", or "didn't come" refer to periods.
- Map cramps/period cramps to "period_pain" with exact evidence quote.
- Set "cycle_pattern": "irregular" (or "absent" if prolonged gap mentioned), and map to "irregular_cycles" with evidence like "missed a few".
7. RED FLAGS:
- Detect urgent danger signs: severe pelvic pain ("acute_severe_pelvic_pain"), soaking a pad every hour ("excessive_hemorrhage"), fainting/dizziness with bleeding ("fainting_syncope"), pregnancy with bleeding ("pregnancy_bleeding_pain"), or self-harm thoughts ("self_harm_ideation").
8. USER LANGUAGE:
- Identify if the input is "en", "hi", "kn", "hinglish", or "kanglish".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `User symptom description:
"""
${cleanedText}
"""`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            user_language: {
              type: Type.STRING,
              description: 'One of en, hi, kn, hinglish, kanglish'
            },
            cycle_pattern: {
              type: Type.STRING,
              description: 'One of regular, irregular, absent, very_long, very_frequent, unknown'
            },
            cycle_gap_months_approx: {
              type: Type.NUMBER,
              description: 'Approximate months since last period if absent, else null'
            },
            denials: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of denied symptom concepts'
            },
            matched_keys: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: {
                    type: Type.STRING,
                    description: 'One of the exact allowed keys'
                  },
                  evidence: {
                    type: Type.STRING,
                    description: 'Exact phrase or quote from the user text'
                  },
                  confidence_note: {
                    type: Type.STRING,
                    description: 'Short rationale why this key matched'
                  }
                },
                required: ['key', 'evidence']
              }
            },
            red_flags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Red flag keys detected if any'
            },
            missing_info: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Relevant clinical items not mentioned by user'
            }
          },
          required: ['cycle_pattern', 'matched_keys', 'red_flags', 'user_language']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');

    // Filter matched keys to strict whitelist and require evidence
    const validKeys = (parsed.matched_keys || []).filter(
      (m: any) =>
        ALLOWED_KEYS.includes(m.key) &&
        m.evidence &&
        typeof m.evidence === 'string' &&
        m.evidence.trim().length > 0
    );

    // Merge red flags detected by deterministic regex check as a safety net
    const mergedRedFlags = Array.from(new Set([...(parsed.red_flags || []), ...rawRedFlags]));

    let cyclePattern = parsed.cycle_pattern || 'unknown';
    // Double check denial override
    if (parsed.denials?.some((d: string) => d.toLowerCase().includes('period') || d.toLowerCase().includes('regular'))) {
      cyclePattern = 'regular';
    }

    return {
      matched_keys: validKeys,
      cycle_pattern: cyclePattern,
      cycle_gap_months_approx: parsed.cycle_gap_months_approx ?? null,
      red_flags: mergedRedFlags,
      missing_info: parsed.missing_info || [
        'Pelvic ultrasound examination status',
        'Timeline of changes'
      ],
      user_language: (parsed.user_language as LanguageCode) || 'en',
      denials: parsed.denials || [],
      raw_text: rawText,
      source: 'gemini'
    };
  } catch (error) {
    console.error('[SakhiCheck] Gemini extraction error, falling back to fuzzy matcher:', error);
    const fallback = fuzzyExtractSymptoms(rawText);
    for (const rf of rawRedFlags) {
      if (!fallback.red_flags.includes(rf)) fallback.red_flags.push(rf);
    }
    return fallback;
  }
}

export async function generatePlainExplanation(
  rawText: string,
  matched: MatchedResult,
  language: LanguageCode
): Promise<string> {
  const ai = getGenAIClient();

  // If red flag triggered, return standard urgent text immediately
  if (matched.red_flag_triggered) {
    const rf = matched.active_red_flags[0];
    return rf?.message[language === 'kn' ? 'kn' : language === 'hi' || language === 'hinglish' ? 'hi' : 'en'] || rf?.message.en || 'Urgent medical care required.';
  }

  if (matched.is_unrelated) {
    return 'These don’t seem related to hormonal health.';
  }

  if (!ai) {
    // Deterministic plain language explanation fallback
    if (matched.isolated_shedding_case) {
      if (language === 'hi' || language === 'hinglish') {
        return 'आपके पीरियड्स नियमित हैं और केवल बाल झड़ रहे हैं। बालों का झड़ना रूसी (डैंड्रफ), तनाव, पोषण (जैसे आयरन या विटामिन डी की कमी) या मौसम की वजह से हो सकता है। यह आमतौर पर पीसीओएस का संकेत नहीं होता। आप किसी त्वचा विशेषज्ञ (डर्मेटोलॉजिस्ट) या डॉक्टर से सलाह ले सकती हैं।';
      }
      if (language === 'kn') {
        return 'ನಿಮ್ಮ ಮುಟ್ಟು ನಿಯಮಿತವಾಗಿದ್ದು, ಕೇವಲ ಕೂದಲು ಉದುರುವಿಕೆ ಮಾತ್ರ ಕಂಡುಬರುತ್ತಿದೆ. ಇದು ತಲೆಯ ಹೊಟ್ಟು, ಒತ್ತಡ, ಅಥವಾ ಪೌಷ್ಟಿಕಾಂಶದ ಕೊರತೆಯಿಂದ ಆಗಿರಬಹುದು. ಇದು ಸಾಮಾನ್ಯವಾಗಿ ಪಿಸಿಒಎಸ್ ಲಕ್ಷಣವಲ್ಲ. ಚರ್ಮರೋಗ ತಜ್ಞರನ್ನು ಸಂಪರ್ಕಿಸಬಹುದು.';
      }
      return 'You reported hair shedding while your menstrual cycle is regular. Hair shedding alone is very common and frequently caused by scalp health (like dandruff), emotional or physical stress, or low iron/vitamin levels, rather than PCOS. A consultation with a dermatologist or family doctor is recommended.';
    }

    if (matched.pcos_rotterdam?.status_label === 'aligns_with_pattern') {
      if (language === 'hi' || language === 'hinglish') {
        return 'आपके बताए गए लक्षण (जैसे अनियमित या रुकी हुई माहवारी और चेहरे पर बाल/पिंपल्स) हार्मोनल बदलाव और पीसीओएस के लक्षणों से मेल खाते हैं। कृपया ध्यान दें कि यह कोई बीमारी का पक्का निदान नहीं है; सही जांच के लिए डॉक्टर पेल्विक अल्ट्रासाउंड और ब्लड टेस्ट करवाने की सलाह दे सकते हैं।';
      }
      if (language === 'kn') {
        return 'ನಿಮ್ಮ ಮುಟ್ಟಿನ ಬದಲಾವಣೆಗಳು ಮತ್ತು ಮುಖದಲ್ಲಿ ಕೂದಲು/ಮೊಡವೆಗಳು ಹಾರ್ಮೋನ್ ಏರುಪೇರು ಅಥವಾ ಪಿಸಿಒಎಸ್ ಲಕ್ಷಣಗಳೊಂದಿಗೆ ಹೊಂದಿಕೆಯಾಗುತ್ತವೆ. ಇದು ಅಂತಿಮ ರೋಗನಿರ್ಣಯವಲ್ಲ; ವೈದ್ಯರು ಅಲ್ಟ್ರಾಸೌಂಡ್ ಮತ್ತು ರಕ್ತ ಪರೀಕ್ಷೆಗಳ ಮೂಲಕ ನಿಖರವಾಗಿ ಪರಿಶೀಲಿಸುತ್ತಾರೆ.';
      }
      return 'The symptoms you shared (cycle irregularities and signs like facial hair or acne) align with common patterns evaluated for PCOS. This is not a diagnosis. A gynecologist can check your hormone levels and perform a pelvic ultrasound to provide personalized clarity.';
    }

    return 'Your symptoms have been organized to help you talk with a doctor. Always consult a healthcare professional for clinical advice.';
  }

  const prompt = `You are SakhiCheck's compassionate health guide for women.
Explain the findings to the user at a Grade-6 reading level in a reassuring, educational, and respectful tone.

LANGUAGE TO USE: ${language === 'hi' || language === 'hinglish' ? 'Conversational Hindi / Hinglish' : language === 'kn' ? 'Kannada' : 'Simple English'}.

HARD SAFETY RULES:
- NEVER claim or state "you have PCOS" or "you have thyroid disorder". Never give a diagnosis or percentage.
- Use phrases like "can be associated with", "aligns with a pattern", and "worth discussing with a doctor".
- Emphasize that a pelvic ultrasound and blood tests are needed for real medical confirmation and cannot be done through an app.
- For hair shedding alone without cycle problems, reassure the user that dandruff, stress, or nutrition are common non-hormonal causes.
- Keep it under 100 words.

User Symptoms: ${matched.extracted_symptoms.map((s) => s.label_display || s.key).join(', ')}
Cycle Pattern: ${matched.pcos_rotterdam?.ovulatory_status || 'not specified'}
Rotterdam Status: ${matched.pcos_rotterdam?.status_label || 'not indicated'}
Surfaced Differential: ${matched.surfaced_conditions.map((c) => c.condition.name).join(', ') || 'General'}`;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.2
      }
    });
    return res.text?.trim() || 'Your symptoms have been summarized for your doctor consultation.';
  } catch (err) {
    console.error('Explanation generation error:', err);
    return 'Your symptoms have been analyzed according to medical guidance frameworks to prepare you for your doctor visit.';
  }
}
