export interface Knot {
  id: string;
  title: string;
  type: 'COMMITMENT' | 'DEADLINE' | 'WAITING' | 'LENT_ITEM' | 'REFUND' | 'APPLICATION' | 'WARRANTY' | 'IMPORTANT_DATE' | 'OTHER';
  status: 'OPEN' | 'WAITING' | 'OVERDUE' | 'RESOLVED';
  threadId: string;
  threadTitle: string;
  personId?: string | null;
  person?: string;
  from?: string;
  to?: string;
  waitingOn?: string;
  thing?: string;
  dueDate?: string | null;
  expectedDate?: string | null;
  nextAction: string;
  resolutionCondition?: string;
  confidence: string;
  createdAt: string;
  resolvedAt?: string | null;
  archived?: boolean;
  evidence: Array<{
    source: string;
    at: string;
    details?: string;
  }>;
}

export interface Person {
  id: string;
  name: string;
  relationship: string;
  birthday?: string;
  notes?: string;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: string;
}

export interface ImportantDate {
  id: string;
  title: string;
  type: 'birthday' | 'occasion' | 'deadline' | 'reminder' | 'important';
  date: string;
  personId?: string | null;
  reminderDays: number;
  note?: string;
  createdAt: string;
}

export interface AppState {
  user: {
    name: string;
    email: string;
    phone?: string;
    preferred?: string;
    dob?: string;
    role?: string;
    college?: string;
    course?: string;
  } | null;
  people: Person[];
  knots: Knot[];
  threads: Thread[];
  notifications: Array<{
    id: string;
    key?: string;
    title: string;
    msg: string;
    at: string;
    read: boolean;
  }>;
  prefs: string[];
  importantDates: ImportantDate[];
}
