/**
 * SakhiCheck: Data Layer (MongoDB-document shaped)
 * Access layer designed to mirror collections in MongoDB Atlas
 */

import conditionsJson from '../data/conditions.json';
import symptomsJson from '../data/symptoms.json';
import carePathwaysJson from '../data/care_pathways.json';
import redFlagsJson from '../data/red_flags.json';
import sessionsJson from '../data/sessions.json';
import {
  Condition,
  Symptom,
  CarePathway,
  RedFlag,
  SessionHistoryItem
} from './types.ts';

const conditions: Condition[] = conditionsJson as unknown as Condition[];
const symptoms: Symptom[] = symptomsJson as unknown as Symptom[];
const carePathways: CarePathway[] = carePathwaysJson as unknown as CarePathway[];
const redFlags: RedFlag[] = redFlagsJson as unknown as RedFlag[];
let sessions: SessionHistoryItem[] = sessionsJson as unknown as SessionHistoryItem[];

export const db = {
  // Conditions
  getConditions(): Condition[] {
    return conditions;
  },
  getConditionByKey(key: string): Condition | undefined {
    return conditions.find((c) => c.key === key);
  },

  // Symptoms
  getSymptoms(): Symptom[] {
    return symptoms;
  },
  getSymptomByKey(key: string): Symptom | undefined {
    return symptoms.find((s) => s.key === key);
  },
  getSymptomsByRotterdam(cat: 'ovulatory_dysfunction' | 'hyperandrogenism'): Symptom[] {
    return symptoms.filter((s) => s.rotterdam_category === cat);
  },

  // Care Pathways
  getCarePathways(): CarePathway[] {
    return carePathways;
  },
  getCarePathwayByCondition(conditionKey: string): CarePathway | undefined {
    return carePathways.find((p) => p.condition_key === conditionKey);
  },

  // Red Flags
  getRedFlags(): RedFlag[] {
    return redFlags;
  },

  // Sessions (Local & seeded mock)
  getSessions(): SessionHistoryItem[] {
    return sessions;
  },
  saveSession(session: SessionHistoryItem): void {
    sessions = [session, ...sessions];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('sakhicheck_sessions');
        const list = stored ? JSON.parse(stored) : [];
        window.localStorage.setItem('sakhicheck_sessions', JSON.stringify([session, ...list].slice(0, 50)));
      }
    } catch {
      // LocalStorage errors ignored in restricted environments
    }
  },
  getLocalStoredSessions(): SessionHistoryItem[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('sakhicheck_sessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      // fallback
    }
    return sessions;
  },
  clearLocalSessions(): void {
    sessions = [];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('sakhicheck_sessions');
      }
    } catch {
      // fallback
    }
  }
};
