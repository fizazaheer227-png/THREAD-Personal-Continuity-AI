import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini SDK with User-Agent telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: Analyze Drop (Text and/or Screenshot Image)
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { text = '', imageBase64 = '', mimeType = 'image/png', existingKnots = [] } = req.body;

    const systemPrompt = `You are the intelligence engine of THREAD — Personal Continuity AI.
Tagline: "Knot to your loose ends."
A "Knot" is something unresolved in a person's life — a promise, deadline, thing they are waiting for, borrowed item, application, purchase/refund, responsibility, or important date.

THREAD understands these loose ends, connects their context, remembers them, and follows them until they are resolved.

CRITICAL RULES FOR SCREENSHOTS (e.g. WhatsApp, iMessage, Slack, Email):
1. Read the actual CONTACT NAME from the chat header or context (e.g. "Venkat", "Sid", "Aiman").
   DO NOT combine random OCR text, timestamps, or status badges into the name. If the header clearly says "Venkat", the person is "Venkat".
2. If the screenshot is a chat message where the contact says: "I'll submit the PDF by Oct 2":
   - Title: "Receive PDF from Venkat"
   - Person: "Venkat"
   - From: "Venkat"
   - To: "User"
   - Waiting on: "Venkat"
   - Type: "COMMITMENT"
   - Status: "WAITING"
   - Expected Date: "2026-10-02"
   - Resolution: "PDF received"
   - Confidence: "High"
3. If the input is spoken or text like "Sid will send me the PPT by October 2":
   - Title: "Receive PPT"
   - Person: "Sid"
   - From: "Sid"
   - To: "User"
   - Waiting on: "Sid"
   - Type: "COMMITMENT"
   - Status: "WAITING"
   - Expected Date: "2026-10-02"
   - Resolution: "PPT received"
   - Confidence: "High"
4. CHECK FOR RESOLUTION OF EXISTING KNOTS:
   We provide a list of existing open knots. If the new message or screenshot indicates that an existing open knot has been fulfilled/delivered/sent (e.g. "Sid sent the PPT" or "Here is the PPT" when there is an open knot "Receive PPT from Sid"), identify it:
   - Set possibleResolutionId to the existing knot's ID
   - Set possibleResolutionTitle to the knot's title
   - Set resolutionDetected to true
   - Set resolutionEvidence to why it resolves it (e.g. "Sid has sent the presentation PPT").
4. If it's a new knot, identify:
   - title: concise, active title (e.g. "Receive PPT from Sid", "Return book to library", "Follow up on laptop repair", "Get calculator back from Sid")
   - person: the person involved (if any)
   - from: who originated the action or promise
   - to: who is receiving or affected
   - waitingOn: who/what is currently blocking or owed (e.g. "Sid", "Repair shop", "College", "Store")
   - type: one of "COMMITMENT", "DEADLINE", "WAITING", "LENT_ITEM", "REFUND", "APPLICATION", "WARRANTY", "IMPORTANT_DATE", "OTHER"
   - status: "WAITING" (if waiting on someone else) or "OPEN" (if action is on user)
   - threadTitle: e.g. "Promptothon", "Laptop Repair", "College", "Commitments", "Things", "People & Dates"
   - thing: any physical item involved (e.g. "calculator", "presentation PPT", "laptop", "certificate")
   - expectedDate: ISO date YYYY-MM-DD if mentioned, or null
   - nextAction: clear statement of what needs to happen next
   - resolutionCondition: exact condition when this Knot is considered resolved (e.g. "When PDF is received from Venkat")
   - confidence: "High" or "Medium"`;

    const contents: any[] = [];
    const parts: any[] = [];

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/png',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
    }

    let userPromptText = `User input / context:\n${text || '(No text provided, see uploaded image)'}`;
    if (existingKnots && existingKnots.length > 0) {
      userPromptText += `\n\nExisting Open Knots in user's THREAD:\n${JSON.stringify(
        existingKnots.map((k: any) => ({ id: k.id, title: k.title, person: k.person || k.waitingOn, type: k.type, status: k.status }))
      )}`;
    }
    userPromptText += `\n\nPlease analyze and extract the Knot or resolution.`;

    parts.push({ text: userPromptText });
    contents.push({ parts });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            resolutionDetected: { type: Type.BOOLEAN, description: 'True if this input resolves an existing knot' },
            possibleResolutionId: { type: Type.STRING, description: 'ID of existing knot resolved' },
            possibleResolutionTitle: { type: Type.STRING, description: 'Title of existing knot resolved' },
            resolutionEvidence: { type: Type.STRING, description: 'Explanation of how this resolves the knot' },
            title: { type: Type.STRING, description: 'Title of the Knot' },
            person: { type: Type.STRING, description: 'Name of the contact or person involved' },
            from: { type: Type.STRING, description: 'From whom' },
            to: { type: Type.STRING, description: 'To whom' },
            waitingOn: { type: Type.STRING, description: 'Who or what the action is waiting on' },
            type: {
              type: Type.STRING,
              description: 'COMMITMENT | DEADLINE | WAITING | LENT_ITEM | REFUND | APPLICATION | WARRANTY | IMPORTANT_DATE | OTHER',
            },
            status: { type: Type.STRING, description: 'WAITING or OPEN' },
            threadTitle: { type: Type.STRING, description: 'Thread/Lifeloop title' },
            thing: { type: Type.STRING, description: 'Object, item, document or money involved' },
            expectedDate: { type: Type.STRING, description: 'Expected date in YYYY-MM-DD format if detected, or empty' },
            nextAction: { type: Type.STRING, description: 'Next step to take or wait for' },
            resolutionCondition: { type: Type.STRING, description: 'Condition to mark knot as resolved' },
            confidence: { type: Type.STRING, description: 'High or Medium' },
          },
          required: ['title', 'type', 'status', 'threadTitle', 'confidence'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json({ success: true, knot: parsed });
  } catch (error: any) {
    console.error('Gemini analyze error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gemini analysis failed' });
  }
});

// Endpoint: Transcribe Audio using Hugging Face Whisper (HF_TOKEN) with fallback
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, error: 'No audio data received' });
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    const hfToken = process.env.HF_TOKEN?.trim();

    let transcript = '';
    let lastHfError: string | null = null;

    if (hfToken) {
      // Hugging Face Whisper API endpoints
      const hfEndpoints = [
        'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
        'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
        'https://api-inference.huggingface.co/models/openai/whisper-base',
      ];

      for (const endpoint of hfEndpoints) {
        try {
          const hfResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': mimeType || 'audio/webm',
            },
            body: audioBuffer,
          });

          if (hfResponse.ok) {
            const hfData = (await hfResponse.json()) as any;
            if (hfData && typeof hfData.text === 'string') {
              transcript = hfData.text.trim();
              if (transcript) break;
            }
          } else {
            const errObj = await hfResponse.json().catch(() => ({}));
            lastHfError = errObj?.error || `Hugging Face returned status ${hfResponse.status} (${hfResponse.statusText})`;
          }
        } catch (fetchErr: any) {
          lastHfError = fetchErr?.message || 'Hugging Face connection error';
        }
      }
    } else {
      console.warn('HF_TOKEN not set in environment. Falling back to Gemini audio processing.');
    }

    // Fallback if Hugging Face did not return a transcript
    if (!transcript) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: cleanBase64,
                },
              },
              {
                text: 'Please transcribe the spoken audio verbatim into clean text. Return only the transcription, nothing else.',
              },
            ],
          },
        });
        transcript = response.text?.trim() || '';
      } catch (geminiError: any) {
        console.error('Audio transcription fallback error:', geminiError);
        return res.status(500).json({
          success: false,
          error: lastHfError || geminiError?.message || 'Audio transcription failed',
        });
      }
    }

    if (!transcript) {
      return res.status(500).json({
        success: false,
        error: lastHfError || 'No speech could be detected from the audio',
      });
    }

    return res.json({
      success: true,
      transcript,
      engine: hfToken && !lastHfError ? 'huggingface-whisper' : 'fallback-transcribe',
    });
  } catch (error: any) {
    console.error('Transcribe endpoint error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Transcription error' });
  }
});

// Alias for backwards compatibility
app.post('/api/gemini/transcribe', (req, res) => {
  res.redirect(307, '/api/transcribe');
});

// Endpoint: AI Reasoning for "What am I forgetting?"
app.post('/api/gemini/forgetting', async (req, res) => {
  try {
    const { knots = [], people = [], threads = [] } = req.body;

    const prompt = `You are THREAD's proactive intelligence for the "What am I forgetting?" feature.
THREAD is NOT a to-do list.
A Knot is something unresolved — a promise, deadline, borrowed item, refund, application, or waiting item.
DO NOT simply list upcoming deadlines.
Reason across the user's data and surface 3-5 sharp, insightful loose ends:
• forgotten loose ends
• overdue commitments
• things waiting too long (e.g. waiting for refund or repair)
• unresolved borrowed/lent items (e.g. "You lent your calculator to Sid 12 days ago and there is no resolution.")
• blocked tasks or missing dependencies
• subtle conflicts

Current Knots:
${JSON.stringify(knots, null, 2)}

People:
${JSON.stringify(people, null, 2)}

Threads:
${JSON.stringify(threads, null, 2)}

Respond with JSON array of objects:
[
  {
    "title": "short summary",
    "insight": "thoughtful, human sentence explaining what is slipping through and why it matters",
    "urgency": "High" | "Medium",
    "category": "Lent Item" | "Waiting Too Long" | "Overdue Commitment" | "Dependency" | "Loose End",
    "knotId": "associated knot ID or null",
    "suggestedAction": "suggested next move"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const insights = JSON.parse(response.text?.trim() || '[]');
    return res.json({ success: true, insights });
  } catch (error: any) {
    console.error('Forgetting AI error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: AI Reasoning for "Brief Me"
app.post('/api/gemini/brief', async (req, res) => {
  try {
    const { mode, personId, knots = [], people = [], threads = [], importantDates = [] } = req.body;

    let targetPerson = null;
    if (personId) {
      targetPerson = people.find((p: any) => p.id === personId);
    }

    const prompt = `You are THREAD generating a personal continuity briefing.
Mode: "${mode}" (can be "today", "work", or "person")
Target Person: ${targetPerson ? JSON.stringify(targetPerson) : 'None'}

User's Knots:
${JSON.stringify(knots, null, 2)}

User's People:
${JSON.stringify(people, null, 2)}

User's Threads:
${JSON.stringify(threads, null, 2)}

User's Important Dates:
${JSON.stringify(importantDates, null, 2)}

Generate a personalized, warm, structured briefing using real context from the data.
Write concise, elegant markdown/html summary.
Include:
- High level status
- Unresolved Knots & Waiting items
- Specific names, items, and dates
- Proactive reminders`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ success: true, briefing: response.text });
  } catch (error: any) {
    console.error('Brief AI error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT) || 3000;

  if (isProd) {
    app.use(express.static('dist'));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`THREAD server running on http://0.0.0.0:${port}`);
  });
}

startServer();
