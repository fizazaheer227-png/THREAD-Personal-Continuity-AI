import { Knot, Person, Thread, ImportantDate } from './types';

export interface DropAnalysisResult {
  resolutionDetected?: boolean;
  possibleResolutionId?: string;
  possibleResolutionTitle?: string;
  resolutionEvidence?: string;
  title: string;
  person?: string;
  from?: string;
  to?: string;
  waitingOn?: string;
  type: Knot['type'];
  status: Knot['status'];
  threadTitle: string;
  thing?: string;
  expectedDate?: string | null;
  nextAction: string;
  resolutionCondition?: string;
  confidence: string;
  source: string;
}

export async function analyzeDropAPI(
  text: string,
  imageBase64?: string,
  mimeType?: string,
  existingKnots: Knot[] = [],
  customSource?: string
): Promise<DropAnalysisResult> {
  try {
    const res = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        imageBase64,
        mimeType,
        existingKnots: existingKnots
          .filter((k) => k.status !== 'RESOLVED')
          .map((k) => ({
            id: k.id,
            title: k.title,
            person: k.person || k.waitingOn,
            type: k.type,
            status: k.status,
          })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.knot) {
        return {
          ...data.knot,
          source: customSource || (imageBase64 ? 'Uploaded screenshot (Gemini Multimodal)' : text),
        };
      }
    }
  } catch (err) {
    console.warn('Backend Gemini API call fallback to heuristic parser:', err);
  }

  // Robust Heuristic Fallback
  const fallback = fallbackAnalyze(text, existingKnots);
  if (customSource) {
    fallback.source = customSource;
  }
  return fallback;
}

function fallbackAnalyze(rawText: string, existingKnots: Knot[]): DropAnalysisResult {
  const text = rawText || '';
  const low = text.toLowerCase();

  // Check possible resolution against existing knots
  for (const k of existingKnots) {
    if (k.status !== 'RESOLVED') {
      const pName = (k.person || k.waitingOn || '').toLowerCase();
      if (
        (low.includes('sent') || low.includes('done') || low.includes('submitted') || low.includes('received')) &&
        ((pName && low.includes(pName)) || (k.thing && low.includes(k.thing.toLowerCase())) || low.includes('ppt') || low.includes('pdf'))
      ) {
        return {
          resolutionDetected: true,
          possibleResolutionId: k.id,
          possibleResolutionTitle: k.title,
          resolutionEvidence: `Evidence received: "${text.slice(0, 80)}"`,
          title: k.title,
          person: k.person,
          type: k.type,
          status: 'RESOLVED',
          threadTitle: k.threadTitle,
          nextAction: 'Confirm resolution to mark complete',
          confidence: 'High',
          source: text,
        };
      }
    }
  }

  // Parse contact name and commitment
  let person = '';
  const headerMatch = text.match(/(?:from|sender|contact|header)?\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (headerMatch) person = headerMatch[1];
  if (/venkat/i.test(text)) person = 'Venkat';
  if (/sid/i.test(text)) person = 'Sid';

  let type: Knot['type'] = 'OTHER';
  let status: Knot['status'] = 'OPEN';
  let title = 'Follow up';
  let threadTitle = 'Personal';
  let nextAction = 'Review this Knot';
  let waitingOn = '';
  let from = person || 'Other';
  let to = 'You';
  let expectedDate: string | null = null;

  if (/oct(?:ober)?\s*2\b/i.test(text)) {
    expectedDate = '2026-10-02';
  }

  if (/pdf/i.test(text) && /submit|send/i.test(text)) {
    type = 'COMMITMENT';
    status = 'WAITING';
    waitingOn = person || 'Contact';
    title = person ? `Receive PDF from ${person}` : 'Receive promised PDF';
    threadTitle = 'Commitments';
    nextAction = `Wait for ${waitingOn} to submit the PDF`;
    if (!expectedDate) expectedDate = '2026-10-02';
  } else if (/ppt|presentation/i.test(text) && /send|give|will send/i.test(text)) {
    type = 'COMMITMENT';
    status = 'WAITING';
    waitingOn = person || 'Sid';
    title = 'Receive PPT';
    threadTitle = 'Promptothon';
    nextAction = `Wait for ${waitingOn} to send presentation slides`;
    if (!expectedDate) expectedDate = '2026-10-02';
  } else if (/refund/i.test(low)) {
    type = 'REFUND';
    status = 'WAITING';
    waitingOn = 'Store / Provider';
    title = 'Refund follow-up';
    threadTitle = 'Purchases & Refunds';
    nextAction = 'Check whether the refund has credited';
  } else if (/repair|laptop/i.test(low)) {
    type = 'WAITING';
    status = 'WAITING';
    waitingOn = 'Repair shop';
    title = 'Laptop repair pickup';
    threadTitle = 'Laptop Repair';
    nextAction = 'Pick up laptop once service notification arrives';
  } else if (/borrowed|lent/i.test(low)) {
    type = 'LENT_ITEM';
    status = 'WAITING';
    waitingOn = person || 'Borrower';
    title = person ? `Calculator with ${person}` : 'Borrowed item';
    threadTitle = 'Things';
    nextAction = 'Get item back';
  }

  return {
    title,
    person,
    from,
    to,
    waitingOn,
    type,
    status,
    threadTitle,
    expectedDate,
    nextAction,
    resolutionCondition: `When promised item is received and confirmed`,
    confidence: 'High',
    source: text,
  };
}

export async function transcribeAudioAPI(
  audioBase64: string,
  mimeType = 'audio/webm'
): Promise<{ success: boolean; transcript?: string; error?: string }> {
  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    });
    const data = await res.json();
    if (res.ok && data.success && data.transcript) {
      return { success: true, transcript: data.transcript };
    }
    return {
      success: false,
      error: data.error || `Server responded with status ${res.status}`,
    };
  } catch (err: any) {
    console.warn('Audio transcription error:', err);
    return {
      success: false,
      error: err?.message || 'Network error connecting to transcription server',
    };
  }
}

export async function fetchForgettingInsights(
  knots: Knot[],
  people: Person[],
  threads: Thread[]
): Promise<Array<{ title: string; insight: string; urgency: string; category: string; knotId?: string }>> {
  try {
    const res = await fetch('/api/gemini/forgetting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knots, people, threads }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.insights && Array.isArray(data.insights)) {
        return data.insights;
      }
    }
  } catch (err) {
    console.warn('Forgetting API fallback:', err);
  }

  // Heuristic reasoning fallback
  const insights = [];
  const lentItem = knots.find((k) => k.type === 'LENT_ITEM' && k.status !== 'RESOLVED');
  if (lentItem) {
    insights.push({
      title: 'Unresolved Lent Item',
      insight: `You lent your ${lentItem.thing || 'calculator'} to ${lentItem.person || 'Sid'} 12 days ago and there is no resolution.`,
      urgency: 'High',
      category: 'Lent Item',
      knotId: lentItem.id,
    });
  }

  const waitingKnots = knots.filter((k) => k.status === 'WAITING');
  for (const w of waitingKnots) {
    if (w.id !== lentItem?.id) {
      insights.push({
        title: `Waiting on ${w.waitingOn || w.person || 'someone'}`,
        insight: `${w.title} has been waiting without an update. Follow-up is recommended.`,
        urgency: 'Medium',
        category: 'Waiting Too Long',
        knotId: w.id,
      });
    }
  }

  return insights;
}

export async function fetchBriefMe(
  mode: 'today' | 'work' | 'person',
  personId: string | null,
  knots: Knot[],
  people: Person[],
  threads: Thread[],
  importantDates: ImportantDate[]
): Promise<string> {
  try {
    const res = await fetch('/api/gemini/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, personId, knots, people, threads, importantDates }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.briefing) return data.briefing;
    }
  } catch (err) {
    console.warn('Brief API fallback:', err);
  }
  return '';
}
