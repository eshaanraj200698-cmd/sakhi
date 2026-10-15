/**
 * SakhiCheck: Backend Express Server
 * Handles Gemini 3.8 Flash server-side operations and API proxy routes
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractSymptomsWithGemini, generatePlainExplanation } from './src/services/geminiService.ts';
import { evaluateSymptoms } from './src/matcher.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// API Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SakhiCheck Server',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY')
  });
});

// Vapi AI Config Route
app.get('/api/vapi/config', (_req: Request, res: Response) => {
  res.json({
    publicKey: process.env.VAPI_PUBLIC_KEY || process.env.VITE_VAPI_PUBLIC_KEY || '',
    assistantId: process.env.VAPI_ASSISTANT_ID || process.env.VITE_VAPI_ASSISTANT_ID || ''
  });
});

// Full symptom analysis pipeline
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { text, language } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text prompt is required.' });
      return;
    }

    const extraction = await extractSymptomsWithGemini(text);
    if (language) {
      extraction.user_language = language;
    }

    const matched = evaluateSymptoms(extraction);

    // Generate plain language explanation
    const explanation = await generatePlainExplanation(text, matched, extraction.user_language);
    matched.plain_explanation = explanation;

    res.json({
      extraction,
      matched
    });
  } catch (error: any) {
    console.error('Error during /api/analyze:', error);
    res.status(500).json({ error: error.message || 'Internal analysis error' });
  }
});

// Standalone extraction
app.post('/api/extract', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text is required.' });
      return;
    }
    const extraction = await extractSymptomsWithGemini(text);
    res.json(extraction);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Extraction failed' });
  }
});

// Standalone evaluation
app.post('/api/evaluate', (req: Request, res: Response) => {
  try {
    const { extraction } = req.body;
    if (!extraction) {
      res.status(400).json({ error: 'Extraction object is required.' });
      return;
    }
    const result = evaluateSymptoms(extraction);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Evaluation failed' });
  }
});

// Serve frontend in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// If run directly via CLI (node or tsx)
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SakhiCheck] Express server running at http://0.0.0.0:${PORT}`);
  });
}

export default app;
