/**
 * SakhiCheck: Client Extraction Service
 * Calls server-side /api/analyze with client-side fallback
 */

import { ExtractionResult, MatchedResult, LanguageCode } from '../types.ts';
import { fuzzyExtractSymptoms } from '../fuzzyMatcher.ts';
import { evaluateSymptoms } from '../matcher.ts';

export async function analyzeUserInput(
  rawText: string,
  languagePreference?: LanguageCode
): Promise<{ extraction: ExtractionResult; matched: MatchedResult }> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: rawText,
        language: languagePreference
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.extraction && data.matched) {
        return data;
      }
    }
  } catch (error) {
    console.warn('[SakhiCheck] API endpoint not reachable or returned error; executing local pipeline:', error);
  }

  // Graceful local deterministic fallback
  const extraction = fuzzyExtractSymptoms(rawText);
  if (languagePreference) {
    extraction.user_language = languagePreference;
  }
  const matched = evaluateSymptoms(extraction);

  return {
    extraction,
    matched
  };
}
