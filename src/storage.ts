import { AppState, Knot, Person, Thread, ImportantDate } from './types';

const STORAGE_KEY = 'threadState';

export function getInitialDemoState(): AppState {
  const sidId = 'person-sid-1';
  const aimanId = 'person-aiman-2';
  const promptothonThreadId = 'thread-promptothon-1';
  const academicsThreadId = 'thread-academics-2';
  const thingsThreadId = 'thread-things-3';

  const demoPeople: Person[] = [
    {
      id: sidId,
      name: 'Sid',
      relationship: 'Teammate',
      notes: 'Hackathon partner for Promptothon. Borrowed my scientific calculator on Sept 14.',
    },
    {
      id: aimanId,
      name: 'Aiman',
      relationship: 'Sister',
      birthday: '2026-10-14',
      notes: 'Loves mystery novels and vintage mechanical pencils.',
    },
    {
      id: 'person-venkat-3',
      name: 'Venkat',
      relationship: 'Project Lead',
      notes: 'Reviewing documentation submission.',
    },
  ];

  const demoThreads: Thread[] = [
    { id: promptothonThreadId, title: 'Promptothon', createdAt: new Date(Date.now() - 3 * 864e5).toISOString() },
    { id: academicsThreadId, title: 'College & Academics', createdAt: new Date(Date.now() - 10 * 864e5).toISOString() },
    { id: thingsThreadId, title: 'Things & Borrowed', createdAt: new Date(Date.now() - 12 * 864e5).toISOString() },
  ];

  const demoKnots: Knot[] = [
    {
      id: 'knot-sid-ppt',
      title: 'Receive PPT from Sid',
      type: 'COMMITMENT',
      status: 'WAITING',
      threadId: promptothonThreadId,
      threadTitle: 'Promptothon',
      personId: sidId,
      person: 'Sid',
      from: 'Sid',
      to: 'You',
      waitingOn: 'Sid',
      thing: 'Presentation PPT',
      dueDate: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
      expectedDate: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
      nextAction: 'Wait for Sid to send the finalized slide deck',
      resolutionCondition: 'Presentation PPT received from Sid',
      confidence: 'High',
      createdAt: new Date(Date.now() - 864e5).toISOString(),
      evidence: [
        {
          source: 'WhatsApp chat with Sid',
          at: new Date(Date.now() - 864e5).toISOString(),
          details: 'Sid: "I\'ll send the presentation slides by tomorrow morning."',
        },
      ],
    },
    {
      id: 'knot-assignment',
      title: 'Assignment submission',
      type: 'DEADLINE',
      status: 'OPEN',
      threadId: academicsThreadId,
      threadTitle: 'College & Academics',
      dueDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
      expectedDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
      nextAction: 'Submit final report PDF through college portal',
      resolutionCondition: 'Assignment uploaded and submission receipt generated',
      confidence: 'High',
      createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
      evidence: [
        {
          source: 'Portal notice screenshot',
          at: new Date(Date.now() - 2 * 864e5).toISOString(),
        },
      ],
    },
    {
      id: 'knot-calculator',
      title: 'Calculator with Sid',
      type: 'LENT_ITEM',
      status: 'WAITING',
      threadId: thingsThreadId,
      threadTitle: 'Things & Borrowed',
      personId: sidId,
      person: 'Sid',
      from: 'You',
      to: 'Sid',
      waitingOn: 'Sid',
      thing: 'Scientific calculator',
      dueDate: null,
      expectedDate: null,
      nextAction: 'Ask Sid to return calculator after hackathon prep',
      resolutionCondition: 'Calculator returned in good condition',
      confidence: 'High',
      createdAt: new Date(Date.now() - 12 * 864e5).toISOString(),
      evidence: [
        {
          source: 'Spoken note / dropped text',
          at: new Date(Date.now() - 12 * 864e5).toISOString(),
          details: 'You lent your calculator to Sid 12 days ago.',
        },
      ],
    },
  ];

  const demoDates: ImportantDate[] = [
    {
      id: 'date-aiman-bday',
      title: "Aiman's birthday",
      type: 'birthday',
      date: '2026-10-14',
      personId: aimanId,
      reminderDays: 3,
      note: 'Order special gift and book reservation',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'date-assignment-due',
      title: 'Assignment submission deadline',
      type: 'deadline',
      date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
      reminderDays: 1,
      note: 'Submit by 11:59 PM',
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    user: {
      name: 'Aiman Zaheer',
      preferred: 'Aiman',
      email: 'aimanzaheer.2005@gmail.com',
      role: 'Student',
      college: 'AI & Computing',
      course: 'Computer Science',
    },
    people: demoPeople,
    knots: demoKnots,
    threads: demoThreads,
    notifications: [
      {
        id: 'notif-1',
        title: 'Welcome to THREAD',
        msg: 'All loose ends are connected and monitored.',
        at: new Date().toISOString(),
        read: false,
      },
    ],
    prefs: [
      'Deadlines & responsibilities',
      'People & important dates',
      'Promises & commitments',
      'Things I’m waiting for',
    ],
    importantDates: demoDates,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialDemoState();
    const parsed = JSON.parse(raw);
    if (!parsed.user) return getInitialDemoState();
    return parsed;
  } catch {
    return getInitialDemoState();
  }
}

export function saveState(state: AppState): void {
  try {
    // 24-hour cleanup for active views
    state.knots.forEach((k) => {
      if (k.status === 'RESOLVED' && k.resolvedAt) {
        const elapsed = Date.now() - new Date(k.resolvedAt).getTime();
        if (elapsed >= 86400000) {
          k.archived = true;
        }
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Error saving state:', err);
  }
}
