import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Knot, Person, Thread, ImportantDate } from './types';
import { loadState, saveState, getInitialDemoState } from './storage';
import { DropModal } from './components/DropModal';
import { KnotDetailModal } from './components/KnotDetailModal';
import { PersonModal } from './components/PersonModal';
import { DateModal } from './components/DateModal';
import { LifeGraph } from './components/LifeGraph';
import { fetchForgettingInsights, fetchBriefMe } from './api';

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [currentView, setCurrentView] = useState<string>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [peopleFilter, setPeopleFilter] = useState<string>('All');
  const [peopleSearch, setPeopleSearch] = useState<string>('');
  const [knotsFilter, setKnotsFilter] = useState<'ALL' | 'OPEN' | 'WAITING' | 'OVERDUE' | 'RESOLVED'>('ALL');

  // Modals
  const [isDropModalOpen, setIsDropModalOpen] = useState<boolean>(false);
  const [autoStartVoice, setAutoStartVoice] = useState<boolean>(false);
  const [selectedKnot, setSelectedKnot] = useState<Knot | null>(null);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState<boolean>(false);
  const [personToEdit, setPersonToEdit] = useState<Person | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState<boolean>(false);
  const [dateModalInitialDate, setDateModalInitialDate] = useState<string>('');

  // Calendar
  const [calendarCursor, setCalendarCursor] = useState<Date>(new Date());

  // Brief Me & Forgetting state
  const [briefMode, setBriefMode] = useState<'today' | 'work' | 'person'>('today');
  const [briefPersonId, setBriefPersonId] = useState<string>('');
  const [briefContent, setBriefContent] = useState<string>('');
  const [isBriefLoading, setIsBriefLoading] = useState<boolean>(false);

  const [forgettingInsights, setForgettingInsights] = useState<any[]>([]);
  const [isForgettingLoading, setIsForgettingLoading] = useState<boolean>(false);

  // Sync to local storage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Check important date reminders
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    state.importantDates.forEach((item) => {
      const targetDate = new Date(item.date + 'T12:00:00');
      targetDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((targetDate.getTime() - today.getTime()) / 864e5);

      if (diffDays === item.reminderDays) {
        const notifKey = `remind-${item.id}-${item.date}`;
        if (!state.notifications.some((n) => n.key === notifKey)) {
          triggerToast(
            'Important Date Reminder',
            `${item.title} is ${diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`}!`,
            notifKey
          );
        }
      }
    });
  }, [state.importantDates]);

  // Notification helper
  const triggerToast = (title: string, msg: string, key?: string) => {
    const newNotif = {
      id: crypto.randomUUID(),
      key,
      title,
      msg,
      at: new Date().toISOString(),
      read: false,
    };
    setState((prev) => ({
      ...prev,
      notifications: [newNotif, ...prev.notifications.slice(0, 9)],
    }));
  };

  // Helper status calculation
  const calcStatus = (k: Knot): Knot['status'] => {
    if (k.status === 'RESOLVED') return 'RESOLVED';
    if (k.dueDate) {
      const due = new Date(k.dueDate + 'T23:59:59');
      if (due < new Date()) return 'OVERDUE';
    }
    return k.status;
  };

  // Active Knots (hides resolved after 24 hrs)
  const activeKnots = useMemo(() => {
    return state.knots.filter((k) => !k.archived && k.status !== 'RESOLVED');
  }, [state.knots]);

  const overdueKnots = useMemo(() => {
    return activeKnots.filter((k) => calcStatus(k) === 'OVERDUE');
  }, [activeKnots]);

  const dueThisWeek = useMemo(() => {
    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 864e5);
    return activeKnots.filter((k) => {
      if (!k.dueDate) return false;
      const d = new Date(k.dueDate + 'T12:00:00');
      return d >= now && d <= oneWeek;
    });
  }, [activeKnots]);

  const waitingKnots = useMemo(() => {
    return activeKnots.filter(
      (k) => k.status === 'WAITING' || ['WAITING', 'COMMITMENT', 'REFUND', 'LENT_ITEM'].includes(k.type)
    );
  }, [activeKnots]);

  // Load Forgetting Insights
  const refreshForgetting = async () => {
    setIsForgettingLoading(true);
    const insights = await fetchForgettingInsights(state.knots, state.people, state.threads);
    setForgettingInsights(insights);
    setIsForgettingLoading(false);
  };

  useEffect(() => {
    if (currentView === 'forgetting') {
      refreshForgetting();
    }
  }, [currentView, state.knots]);

  // Load Brief Me
  const refreshBrief = async () => {
    setIsBriefLoading(true);
    const pId = briefMode === 'person' ? briefPersonId || state.people[0]?.id || null : null;
    const text = await fetchBriefMe(briefMode, pId, state.knots, state.people, state.threads, state.importantDates);
    setBriefContent(text);
    setIsBriefLoading(false);
  };

  useEffect(() => {
    if (currentView === 'brief') {
      refreshBrief();
    }
  }, [currentView, briefMode, briefPersonId, state.knots]);

  // Knot Handlers
  const handleSaveKnot = (data: Partial<Knot>) => {
    // Ensure thread exists
    let thread = state.threads.find((t) => t.title.toLowerCase() === (data.threadTitle || '').toLowerCase());
    let threadId = thread?.id;
    if (!thread) {
      threadId = crypto.randomUUID();
      const newThread: Thread = {
        id: threadId,
        title: data.threadTitle || 'Personal',
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({ ...prev, threads: [...prev.threads, newThread] }));
    }

    // Ensure person exists
    let personId: string | null = null;
    if (data.person) {
      let p = state.people.find((person) => person.name.toLowerCase() === data.person?.toLowerCase());
      if (p) {
        personId = p.id;
      } else {
        personId = crypto.randomUUID();
        const newPerson: Person = {
          id: personId,
          name: data.person,
          relationship: 'Connection',
        };
        setState((prev) => ({ ...prev, people: [...prev.people, newPerson] }));
      }
    }

    const newKnot: Knot = {
      id: crypto.randomUUID(),
      title: data.title || 'New Knot',
      type: data.type || 'OTHER',
      status: data.status || 'OPEN',
      threadId: threadId || 'default-thread',
      threadTitle: data.threadTitle || 'Personal',
      personId,
      person: data.person,
      from: data.from || 'You',
      to: data.to || (data.person ? 'You' : 'Other'),
      waitingOn: data.waitingOn || data.person,
      thing: data.thing,
      dueDate: data.dueDate || null,
      expectedDate: data.expectedDate || null,
      nextAction: data.nextAction || 'Follow up to resolve',
      resolutionCondition: data.resolutionCondition,
      confidence: data.confidence || 'High',
      createdAt: new Date().toISOString(),
      evidence: data.evidence || [
        {
          source: 'User entered',
          at: new Date().toISOString(),
        },
      ],
    };

    setState((prev) => ({ ...prev, knots: [newKnot, ...prev.knots] }));
    triggerToast('Knot Created', `"${newKnot.title}" added to your THREAD.`);
  };

  const handleResolveExistingKnot = (knotId: string, evidenceText: string) => {
    setState((prev) => ({
      ...prev,
      knots: prev.knots.map((k) => {
        if (k.id === knotId) {
          return {
            ...k,
            status: 'RESOLVED' as const,
            resolvedAt: new Date().toISOString(),
            evidence: [
              ...k.evidence,
              {
                source: 'Resolution evidence',
                at: new Date().toISOString(),
                details: evidenceText,
              },
            ],
          };
        }
        return k;
      }),
    }));
    triggerToast('Knot Resolved ✓', 'Marked resolved. Stays visible in tasks for 24h, retained in thread.');
  };

  const handleDeleteKnot = (knotId: string) => {
    setState((prev) => ({
      ...prev,
      knots: prev.knots.filter((k) => k.id !== knotId),
    }));
    triggerToast('Knot Deleted', 'Knot removed from your THREAD.');
  };

  const handleUpdateKnot = (updatedKnot: Knot) => {
    setState((prev) => ({
      ...prev,
      knots: prev.knots.map((k) => (k.id === updatedKnot.id ? updatedKnot : k)),
    }));
    triggerToast('Knot Updated', `"${updatedKnot.title}" updated.`);
  };

  // People Handlers
  const handleSavePerson = (personData: Partial<Person>) => {
    if (personData.id) {
      setState((prev) => ({
        ...prev,
        people: prev.people.map((p) => (p.id === personData.id ? ({ ...p, ...personData } as Person) : p)),
      }));
      triggerToast('Person Updated', `${personData.name} updated.`);
    } else {
      const newPerson: Person = {
        id: crypto.randomUUID(),
        name: personData.name || 'New Person',
        relationship: personData.relationship || 'Connection',
        birthday: personData.birthday,
        notes: personData.notes,
      };
      setState((prev) => ({ ...prev, people: [...prev.people, newPerson] }));
      triggerToast('Person Added', `${newPerson.name} added to your THREAD.`);
    }
  };

  // Date Handlers
  const handleSaveDate = (dateItem: Partial<ImportantDate>) => {
    const newDate: ImportantDate = {
      id: crypto.randomUUID(),
      title: dateItem.title || 'Important Date',
      type: dateItem.type || 'important',
      date: dateItem.date || new Date().toISOString().slice(0, 10),
      personId: dateItem.personId || null,
      reminderDays: dateItem.reminderDays ?? 1,
      note: dateItem.note,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, importantDates: [...prev.importantDates, newDate] }));
    triggerToast('Important Date Saved', `${newDate.title} on ${newDate.date}.`);
  };

  // Demo Scenarios
  const handleLoadDemo = () => {
    const demo = getInitialDemoState();
    setState(demo);
    triggerToast('Demo Scenario Loaded', 'Loaded Sid, Aiman, Promptothon, and Assignment submission.');
  };

  const handleClearData = () => {
    if (confirm('Clear all THREAD data in this browser?')) {
      localStorage.removeItem('threadState');
      setState(getInitialDemoState());
      triggerToast('Data Reset', 'Demo data reinitialized.');
    }
  };

  const greetingTime = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'morning';
    if (hr < 17) return 'afternoon';
    return 'evening';
  };

  return (
    <div className="app">
      {/* Toast Notification Container */}
      <div className="toast-wrap">
        {state.notifications.slice(0, 3).map((n) => (
          <div key={n.id} className="toast">
            <strong>{n.title}</strong>
            <span className="text-xs text-gray-700">{n.msg}</span>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="side">
        <div>
          <div className="brand cursor-pointer" onClick={() => setCurrentView('home')}>
            <span>◉</span> THREAD
          </div>
          <nav className="nav">
            <button
              className={currentView === 'home' ? 'active' : ''}
              onClick={() => setCurrentView('home')}
            >
              <span>⌂</span> Home
            </button>
            <button
              className={currentView === 'threads' ? 'active' : ''}
              onClick={() => setCurrentView('threads')}
            >
              <span>◉</span> My Threads
            </button>
            <button
              className={currentView === 'knots' ? 'active' : ''}
              onClick={() => setCurrentView('knots')}
            >
              <span>⌘</span> Knots
            </button>
            <button
              className={currentView === 'people' ? 'active' : ''}
              onClick={() => setCurrentView('people')}
            >
              <span>♙</span> People
            </button>
            <button
              className={currentView === 'waiting' ? 'active' : ''}
              onClick={() => setCurrentView('waiting')}
            >
              <span>⌛</span> Waiting Room
            </button>
            <button
              className={currentView === 'calendar' ? 'active' : ''}
              onClick={() => setCurrentView('calendar')}
            >
              <span>▣</span> Calendar
            </button>
            <button
              className={currentView === 'forgetting' ? 'active' : ''}
              onClick={() => setCurrentView('forgetting')}
            >
              <span>✦</span> What am I forgetting?
            </button>
            <button
              className={currentView === 'brief' ? 'active' : ''}
              onClick={() => setCurrentView('brief')}
            >
              <span>☀</span> Brief Me
            </button>
            <button
              className={currentView === 'before' ? 'active' : ''}
              onClick={() => setCurrentView('before')}
            >
              <span>◌</span> BEFORE
            </button>
            <button
              className={currentView === 'graph' ? 'active' : ''}
              onClick={() => setCurrentView('graph')}
            >
              <span>⌘</span> Life Graph
            </button>
            <button
              className={currentView === 'settings' ? 'active' : ''}
              onClick={() => setCurrentView('settings')}
            >
              <span>⚙</span> Settings
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-gray-700/40">
          <small className="text-gray-400 block text-xs">LOGGED IN AS</small>
          <span className="font-semibold text-sm">{state.user?.name || 'Aiman Zaheer'}</span>
        </div>
      </aside>

      {/* Main Body */}
      <main className="main">
        {/* Top Search & Actions */}
        <div className="top">
          <input
            className="search"
            placeholder="Search anything… e.g. 'what am I waiting for?'"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                setCurrentView('knots');
              }
            }}
          />
          <div className="flex gap-2">
            <button
              className="btn soft"
              onClick={() => setIsDropModalOpen(true)}
              title="Drop screenshot, text or voice"
            >
              + Drop Anything
            </button>
            <button
              className="btn alt"
              onClick={() => triggerToast('Notifications', `You have ${activeKnots.length} active Knots.`)}
            >
              🔔
            </button>
          </div>
        </div>

        {/* 1. HOME VIEW */}
        {currentView === 'home' && (
          <div className="mt-4">
            <h1 className="greeting font-serif">
              Good {greetingTime()}, {state.user?.preferred || state.user?.name?.split(' ')[0] || 'there'}
            </h1>
            <p className="quote hand">“One step at a time, one less Knot to worry about.”</p>

            {/* 5 Stats */}
            <div className="stats">
              <div className="stat cursor-pointer" onClick={() => setCurrentView('knots')}>
                <small className="text-muted font-bold">Open Knots</small>
                <b>{activeKnots.length}</b>
              </div>
              <div className="stat cursor-pointer" onClick={() => setCurrentView('knots')}>
                <small className="text-muted font-bold">Overdue</small>
                <b className="text-red-700">{overdueKnots.length}</b>
              </div>
              <div className="stat cursor-pointer" onClick={() => setCurrentView('calendar')}>
                <small className="text-muted font-bold">Due this week</small>
                <b>{dueThisWeek.length}</b>
              </div>
              <div className="stat cursor-pointer" onClick={() => setCurrentView('people')}>
                <small className="text-muted font-bold">People</small>
                <b>{state.people.length}</b>
              </div>
              <div className="stat cursor-pointer" onClick={() => setCurrentView('graph')}>
                <small className="text-muted font-bold">Evidence Items</small>
                <b>{state.knots.reduce((acc, k) => acc + (k.evidence?.length || 0), 0)}</b>
              </div>
            </div>

            {/* Main Grid */}
            <div className="grid">
              <div>
                {/* Drop Anything Card */}
                <div className="card drop cursor-pointer" onClick={() => setIsDropModalOpen(true)}>
                  <h2 className="font-serif">Drop Anything</h2>
                  <div className="hand text-xl my-1">“You share. I find the Knots.”</div>
                  <p className="text-sm text-gray-700 max-w-md mx-auto">
                    Screenshot, message, PDF, receipt, voice note or text — THREAD finds the Knot, connects the context
                    and creates a LifeLoop.
                  </p>
                  <div className="drop-options" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setIsDropModalOpen(true)}>✎ Text</button>
                    <button onClick={() => setIsDropModalOpen(true)}>💬 Message</button>
                    <button onClick={() => setIsDropModalOpen(true)}>▧ Document</button>
                    <button onClick={() => setIsDropModalOpen(true)}>▤ Receipt</button>
                    <button
                      className="bg-purple-100 hover:bg-purple-200"
                      onClick={() => {
                        setAutoStartVoice(true);
                        setIsDropModalOpen(true);
                      }}
                    >
                      ◉ Voice
                    </button>
                  </div>
                </div>

                {/* Feature Row Buttons */}
                <div className="feature-row">
                  <button className="feature" onClick={() => setCurrentView('forgetting')}>
                    <b>✨ Forgetting?</b>
                    <br />
                    <small>I’ll look ahead.</small>
                  </button>
                  <button className="feature" onClick={() => setCurrentView('brief')}>
                    <b>☀ Brief Me</b>
                    <br />
                    <small>Right when you need it.</small>
                  </button>
                  <button className="feature" onClick={() => setCurrentView('before')}>
                    <b>◌ BEFORE</b>
                    <br />
                    <small>What happens next matters.</small>
                  </button>
                </div>

                {/* Attention Knots */}
                <div className="card mt-4">
                  <div className="section-title">
                    <h2 className="font-serif text-xl">Knots that need your attention</h2>
                    <button className="btn alt text-xs" onClick={() => setCurrentView('knots')}>
                      See all
                    </button>
                  </div>
                  <div className="knot-list">
                    {activeKnots.slice(0, 4).map((k) => (
                      <div
                        key={k.id}
                        className="knot cursor-pointer"
                        onClick={() => setSelectedKnot(k)}
                      >
                        <div>
                          <b>{k.title}</b>
                          <br />
                          <small className="text-muted">
                            {k.threadTitle}
                            {k.dueDate ? ` · Due ${k.dueDate}` : ''}
                            {k.person ? ` · ${k.person}` : ''}
                          </small>
                        </div>
                        <span className={`pill ${calcStatus(k).toLowerCase()}`}>
                          {calcStatus(k).replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                    {activeKnots.length === 0 && (
                      <div className="empty">
                        <div className="symbol">⌁</div>
                        <b>No Knots yet.</b>
                        <p>Drop something from your life and THREAD will figure out what happens next.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Threads + Upcoming */}
              <div>
                <div className="card">
                  <div className="section-title">
                    <h2 className="font-serif text-xl">My Threads</h2>
                    <button className="btn alt text-xs" onClick={() => setCurrentView('threads')}>
                      See all
                    </button>
                  </div>
                  <div className="space-y-3">
                    {state.threads.slice(0, 4).map((t) => {
                      const tKnots = state.knots.filter((k) => k.threadId === t.id);
                      const resolved = tKnots.filter((k) => k.status === 'RESOLVED').length;
                      const pct = tKnots.length ? Math.round((resolved / tKnots.length) * 100) : 0;
                      return (
                        <div
                          key={t.id}
                          className="p-3 bg-white rounded-xl border border-line cursor-pointer hover:border-purple-300"
                          onClick={() => setCurrentView('threads')}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <b className="font-serif text-navy">{t.title}</b>
                            <span className="pill">{pct}%</span>
                          </div>
                          <div className="progress-track mb-1">
                            <i style={{ width: `${pct}%` }} />
                          </div>
                          <small className="text-muted">
                            {resolved}/{tKnots.length} Knots resolved
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card mt-4">
                  <h2 className="font-serif text-xl mb-3">Upcoming Highlights</h2>
                  <div className="space-y-2">
                    {state.importantDates.slice(0, 3).map((d) => (
                      <div
                        key={d.id}
                        className="p-3 bg-white rounded-xl border border-line flex justify-between items-center cursor-pointer"
                        onClick={() => setCurrentView('calendar')}
                      >
                        <div>
                          <b>
                            {d.type === 'birthday' ? '🎂 ' : '⏰ '}
                            {d.title}
                          </b>
                          <br />
                          <small className="text-muted">{d.date}</small>
                        </div>
                        <span className="text-xs bg-peach/60 px-2 py-1 rounded-full font-bold">
                          {d.reminderDays}d before
                        </span>
                      </div>
                    ))}
                    {state.importantDates.length === 0 && (
                      <small className="text-muted">No upcoming dates marked yet.</small>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. MY THREADS (LIFELOOPS) VIEW */}
        {currentView === 'threads' && (
          <div className="mt-4">
            <div className="section-title">
              <div>
                <h1 className="font-serif">My Threads</h1>
                <p className="hand text-lg">“Related Knots, kept together.”</p>
              </div>
              <button className="btn soft" onClick={() => setIsDropModalOpen(true)}>
                + New Knot
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {state.threads.map((t) => {
                const tKnots = state.knots.filter((k) => k.threadId === t.id);
                const resolvedCount = tKnots.filter((k) => k.status === 'RESOLVED').length;
                const pct = tKnots.length ? Math.round((resolvedCount / tKnots.length) * 100) : 0;

                return (
                  <details key={t.id} className="thread-card" open={tKnots.length > 0}>
                    <summary>
                      <div>
                        <b>{t.title}</b>
                        <br />
                        <small className="text-muted">
                          {resolvedCount}/{tKnots.length} Knots resolved
                        </small>
                      </div>
                      <div className="thread-summary-right">
                        <span className="pill">{pct}%</span>
                        <span className="chev font-bold text-gray-500">⌄</span>
                      </div>
                    </summary>
                    <div className="progress-track">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <div className="thread-knot-list">
                      {tKnots.map((k) => (
                        <div
                          key={k.id}
                          className="thread-knot-row"
                          onClick={() => setSelectedKnot(k)}
                        >
                          <div>
                            <b>{k.title}</b>
                            <small>
                              {k.type.replace('_', ' ')}
                              {k.dueDate ? ` · Due ${k.dueDate}` : ''}
                              {k.person ? ` · With ${k.person}` : ''}
                            </small>
                          </div>
                          <span className={`pill ${calcStatus(k).toLowerCase()}`}>
                            {calcStatus(k).replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                      {tKnots.length === 0 && (
                        <div className="empty">No Knots saved in this Thread yet.</div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. KNOTS VIEW */}
        {currentView === 'knots' && (
          <div className="mt-4">
            <div className="section-title">
              <div>
                <h1 className="font-serif">Knots</h1>
                <p className="hand text-lg">“Know your loose ends.”</p>
              </div>
              <button className="btn soft" onClick={() => setIsDropModalOpen(true)}>
                + New Knot
              </button>
            </div>

            {/* Filter Chips */}
            <div className="chips my-3">
              {(['ALL', 'OPEN', 'WAITING', 'OVERDUE', 'RESOLVED'] as const).map((filter) => (
                <button
                  key={filter}
                  className={`chip ${knotsFilter === filter ? 'active' : ''}`}
                  onClick={() => setKnotsFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="knot-list mt-3">
              {state.knots
                .filter((k) => {
                  if (k.archived && knotsFilter !== 'RESOLVED') return false;
                  const st = calcStatus(k);
                  if (knotsFilter === 'OPEN') return st === 'OPEN';
                  if (knotsFilter === 'WAITING') return st === 'WAITING';
                  if (knotsFilter === 'OVERDUE') return st === 'OVERDUE';
                  if (knotsFilter === 'RESOLVED') return st === 'RESOLVED';
                  return true;
                })
                .filter((k) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    k.title.toLowerCase().includes(q) ||
                    (k.person && k.person.toLowerCase().includes(q)) ||
                    k.threadTitle.toLowerCase().includes(q) ||
                    k.nextAction.toLowerCase().includes(q)
                  );
                })
                .map((k) => (
                  <div
                    key={k.id}
                    className="knot cursor-pointer"
                    onClick={() => setSelectedKnot(k)}
                  >
                    <div>
                      <b>{k.title}</b>
                      <br />
                      <small className="text-muted">
                        {k.threadTitle}
                        {k.dueDate ? ` · Due ${k.dueDate}` : ''}
                        {k.person ? ` · ${k.person}` : ''}
                        {k.waitingOn && k.status === 'WAITING' ? ` · Waiting on ${k.waitingOn}` : ''}
                      </small>
                    </div>
                    <span className={`pill ${calcStatus(k).toLowerCase()}`}>
                      {calcStatus(k).replace('_', ' ')}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 4. PEOPLE VIEW */}
        {currentView === 'people' && (
          <div className="mt-4">
            <div className="section-title">
              <div>
                <h1 className="font-serif">People</h1>
                <p className="hand text-lg">Promises, plans, birthdays and the context you choose to remember.</p>
              </div>
              <button
                className="btn soft"
                onClick={() => {
                  setPersonToEdit(null);
                  setIsPersonModalOpen(true);
                }}
              >
                + Add Person
              </button>
            </div>

            <div className="people-toolbar">
              <input
                placeholder="Search people…"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
              />
              <div className="chips">
                {['All', 'Family', 'Friends', 'College/Work'].map((cat) => (
                  <button
                    key={cat}
                    className={`chip ${peopleFilter === cat ? 'active' : ''}`}
                    onClick={() => setPeopleFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="people">
              {state.people
                .filter((p) => {
                  if (peopleFilter === 'Family') return /sister|brother|mom|dad|family|parent/i.test(p.relationship);
                  if (peopleFilter === 'Friends') return /friend/i.test(p.relationship);
                  if (peopleFilter === 'College/Work') return /team|work|college|lead|mentor|prof/i.test(p.relationship);
                  return true;
                })
                .filter((p) => {
                  if (!peopleSearch) return true;
                  const q = peopleSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q) || p.relationship.toLowerCase().includes(q);
                })
                .map((p) => {
                  const pKnots = state.knots.filter(
                    (k) => k.personId === p.id || k.person?.toLowerCase() === p.name.toLowerCase()
                  );
                  const pWaiting = pKnots.filter((k) => k.status === 'WAITING');
                  const pLent = pKnots.filter((k) => k.thing || k.type === 'LENT_ITEM');

                  return (
                    <div key={p.id} className="person">
                      <div className="avatar">{p.name[0]}</div>
                      <h3 className="font-bold text-lg">{p.name}</h3>
                      <small className="text-muted block">{p.relationship}</small>
                      <p className="text-xs my-2 text-gray-700">
                        {p.birthday ? `🎂 Birthday: ${p.birthday}` : 'Birthday not added'}
                      </p>
                      <b className="text-xs text-purple-900 font-bold block mb-2">
                        {pKnots.filter((k) => k.status !== 'RESOLVED').length} active Knots
                      </b>

                      <div className="person-detail">
                        {p.notes && (
                          <div>
                            <b className="text-gray-500 text-xs block">Saved Context</b>
                            <p className="text-xs text-gray-800">{p.notes}</p>
                          </div>
                        )}

                        <div>
                          <b className="text-gray-500 text-xs block">Connected Knots</b>
                          {pKnots.length > 0 ? (
                            <div className="space-y-1 mt-1">
                              {pKnots.map((k) => (
                                <div
                                  key={k.id}
                                  className="text-xs text-purple-900 hover:underline cursor-pointer"
                                  onClick={() => setSelectedKnot(k)}
                                >
                                  • {k.title} ({calcStatus(k)})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted">No related Knots yet</span>
                          )}
                        </div>

                        {pWaiting.length > 0 && (
                          <div>
                            <b className="text-gray-500 text-xs block">Waiting On {p.name}</b>
                            <div className="space-y-1 text-xs text-coral font-medium">
                              {pWaiting.map((k) => (
                                <div key={k.id}>⌛ {k.title}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {pLent.length > 0 && (
                          <div>
                            <b className="text-gray-500 text-xs block">Borrowed / Lent Items</b>
                            <div className="space-y-1 text-xs text-blue-900">
                              {pLent.map((k) => (
                                <div key={k.id}>📦 {k.thing || k.title}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="person-actions">
                          <button
                            onClick={() => {
                              setPersonToEdit(p);
                              setIsPersonModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setIsDropModalOpen(true);
                            }}
                          >
                            + Knot
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 5. WAITING ROOM VIEW */}
        {currentView === 'waiting' && (
          <div className="mt-4">
            <h1 className="font-serif">Waiting Room</h1>
            <p className="hand text-lg mb-4">
              “Some things aren’t yours to do — but they’re still yours to remember.”
            </p>

            <div className="knot-list">
              {waitingKnots.map((k) => {
                const elapsedDays = Math.floor((Date.now() - new Date(k.createdAt).getTime()) / 864e5);
                return (
                  <div
                    key={k.id}
                    className="p-4 bg-white rounded-2xl border border-line shadow-sm cursor-pointer hover:border-purple-300"
                    onClick={() => setSelectedKnot(k)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <b className="text-lg font-serif text-navy">
                          {k.waitingOn || k.person || 'Someone'} → {k.thing || k.title}
                        </b>
                        <p className="text-xs text-muted mt-0.5">
                          {k.threadTitle} · Waiting for {elapsedDays === 0 ? 'today' : `${elapsedDays} day(s)`}
                        </p>
                      </div>
                      <span className="pill waiting">WAITING</span>
                    </div>

                    <p className="text-sm text-gray-800 bg-lav/20 p-2.5 rounded-xl my-2">
                      <b>Next Action:</b> {k.nextAction}
                    </p>

                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Expected: {k.expectedDate || k.dueDate || 'Pending confirmation'}</span>
                      <span>Source: {k.evidence?.[0]?.source || 'Uploaded context'}</span>
                    </div>
                  </div>
                );
              })}

              {waitingKnots.length === 0 && (
                <div className="empty">
                  <div className="symbol">⌛</div>
                  <b>Nothing waiting right now.</b>
                  <p>When you are waiting on someone (like Sid sending slides or a store refund), it shows here.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. CALENDAR VIEW */}
        {currentView === 'calendar' && (
          <div className="mt-4">
            <div className="section-title">
              <div>
                <h1 className="font-serif">Calendar</h1>
                <p className="hand text-lg">Knots, birthdays, occasions and dates you never want to miss.</p>
              </div>
              <button
                className="btn soft"
                onClick={() => {
                  setDateModalInitialDate('');
                  setIsDateModalOpen(true);
                }}
              >
                + Mark Important Date
              </button>
            </div>

            <div className="calendar-head">
              <div className="calendar-actions">
                <button
                  className="btn alt"
                  onClick={() =>
                    setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1))
                  }
                >
                  ←
                </button>
                <button className="btn alt" onClick={() => setCalendarCursor(new Date())}>
                  Today
                </button>
                <button
                  className="btn alt"
                  onClick={() =>
                    setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1))
                  }
                >
                  →
                </button>
              </div>
              <h2 className="font-serif text-xl">
                {calendarCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <small className="text-muted">Double-click any day to mark an event</small>
            </div>

            {/* Calendar Grid */}
            <div className="calendar">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <b key={day} className="text-center text-xs text-gray-500 py-1">
                  {day}
                </b>
              ))}

              {/* Blank initial days */}
              {Array.from({
                length: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1).getDay(),
              }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {/* Days of month */}
              {Array.from({
                length: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0).getDate(),
              }).map((_, i) => {
                const dayNum = i + 1;
                const dObj = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), dayNum, 12);
                const isoStr = `${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth() + 1).padStart(
                  2,
                  '0'
                )}-${String(dayNum).padStart(2, '0')}`;

                const knotsOnDay = state.knots.filter((k) => k.dueDate === isoStr || k.expectedDate === isoStr);
                const datesOnDay = state.importantDates.filter((item) => item.date === isoStr);
                const bdaysOnDay = state.people.filter((p) => {
                  if (!p.birthday) return false;
                  const bDate = new Date(p.birthday + 'T12:00:00');
                  return bDate.getMonth() === calendarCursor.getMonth() && bDate.getDate() === dayNum;
                });

                return (
                  <div
                    key={dayNum}
                    className="day hover:border-purple-300 cursor-pointer"
                    onDoubleClick={() => {
                      setDateModalInitialDate(isoStr);
                      setIsDateModalOpen(true);
                    }}
                  >
                    <b>{dayNum}</b>

                    {knotsOnDay.map((k) => (
                      <div
                        key={k.id}
                        className="evt font-semibold text-navy truncate"
                        title={k.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedKnot(k);
                        }}
                      >
                        • {k.title}
                      </div>
                    ))}

                    {bdaysOnDay.map((p) => (
                      <div
                        key={p.id}
                        className="evt date-event birthday truncate font-semibold"
                        title={`Birthday: ${p.name}`}
                      >
                        🎂 {p.name}
                      </div>
                    ))}

                    {datesOnDay.map((d) => (
                      <div
                        key={d.id}
                        className={`evt date-event ${d.type} truncate font-semibold`}
                        title={`${d.title} (Reminder: ${d.reminderDays}d before)`}
                      >
                        {d.type === 'birthday' ? '🎂 ' : d.type === 'deadline' ? '⏰ ' : '📌 '}
                        {d.title}
                      </div>
                    ))}

                    <div
                      className="text-xs text-purple-700/60 mt-1 hover:underline"
                      onClick={() => {
                        setDateModalInitialDate(isoStr);
                        setIsDateModalOpen(true);
                      }}
                    >
                      + add
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. WHAT AM I FORGETTING? VIEW */}
        {currentView === 'forgetting' && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <h1 className="font-serif">What am I forgetting?</h1>
              <button
                className="btn alt text-xs"
                onClick={refreshForgetting}
                disabled={isForgettingLoading}
              >
                {isForgettingLoading ? 'Thinking...' : '🔄 Reason again'}
              </button>
            </div>
            <p className="hand text-lg mb-4">“I’ll look ahead so you don’t have to.”</p>

            <div className="card">
              <p className="text-xs text-muted mb-4">
                THREAD reasons across your promises, lent items, waiting durations, and dependencies to find what is
                quietly slipping through.
              </p>

              {isForgettingLoading ? (
                <div className="p-8 text-center text-muted">
                  <div className="text-3xl animate-spin mb-2">✦</div>
                  <p className="font-serif">Reasoning across your Knots, Threads, and People...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {forgettingInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white rounded-2xl border border-line shadow-sm hover:border-purple-300"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="pill overdue">{insight.category || 'Loose End'}</span>
                        <span className="text-xs text-red-700 font-bold">{insight.urgency} Urgency</span>
                      </div>
                      <b className="text-base text-navy block mt-1">{insight.title}</b>
                      <p className="text-sm text-gray-800 my-2">{insight.insight}</p>
                      {insight.knotId && (
                        <button
                          className="btn alt text-xs py-1 px-3 mt-1"
                          onClick={() => {
                            const found = state.knots.find((k) => k.id === insight.knotId);
                            if (found) setSelectedKnot(found);
                          }}
                        >
                          View Connected Knot →
                        </button>
                      )}
                    </div>
                  ))}

                  {forgettingInsights.length === 0 && (
                    <div className="empty">
                      <div className="symbol">✨</div>
                      <b>Nothing urgent slipping through.</b>
                      <p>All loose ends and promises are on track.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. BRIEF ME VIEW */}
        {currentView === 'brief' && (
          <div className="mt-4">
            <h1 className="font-serif">Brief Me</h1>
            <p className="hand text-lg mb-4">“All you need to know, right when you need it.”</p>

            <div className="chips mb-3">
              <button
                className={`chip ${briefMode === 'today' ? 'active' : ''}`}
                onClick={() => setBriefMode('today')}
              >
                For Today
              </button>
              <button
                className={`chip ${briefMode === 'work' ? 'active' : ''}`}
                onClick={() => setBriefMode('work')}
              >
                For College / Work
              </button>
              <button
                className={`chip ${briefMode === 'person' ? 'active' : ''}`}
                onClick={() => setBriefMode('person')}
              >
                About a Person
              </button>
            </div>

            {briefMode === 'person' && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">Select Person:</span>
                <select
                  className="p-2 border rounded-xl bg-white text-xs outline-none"
                  value={briefPersonId}
                  onChange={(e) => setBriefPersonId(e.target.value)}
                >
                  <option value="">Choose person...</option>
                  {state.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.relationship})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="card">
              {isBriefLoading ? (
                <div className="p-8 text-center text-muted">
                  <div className="text-3xl animate-pulse mb-2">☀</div>
                  <p>Synthesizing personal continuity brief...</p>
                </div>
              ) : (
                <div>
                  <h2 className="font-serif text-xl mb-2">
                    {briefMode === 'today'
                      ? 'Daily Continuity Briefing'
                      : briefMode === 'work'
                      ? 'Academic & Project Continuity'
                      : `Briefing: ${state.people.find((p) => p.id === briefPersonId)?.name || 'Selected Contact'}`}
                  </h2>

                  {briefContent ? (
                    <div className="prose text-sm text-gray-800 leading-relaxed whitespace-pre-line p-3 bg-white rounded-xl border border-line">
                      {briefContent}
                    </div>
                  ) : (
                    <div className="p-4 bg-white rounded-xl border border-line text-sm text-gray-800 space-y-2">
                      <p>
                        You currently have <b>{activeKnots.length} open Knots</b>, with{' '}
                        <b>{waitingKnots.length} waiting</b> on someone else and{' '}
                        <b>{overdueKnots.length} requiring immediate attention</b>.
                      </p>
                      {briefMode === 'person' && (
                        <div>
                          <b className="block mt-2 font-bold text-navy">Connected Knots:</b>
                          {state.knots
                            .filter(
                              (k) =>
                                k.personId === briefPersonId ||
                                k.person?.toLowerCase() ===
                                  state.people.find((p) => p.id === briefPersonId)?.name?.toLowerCase()
                            )
                            .map((k) => (
                              <p key={k.id} className="text-xs text-gray-700">
                                • {k.title} — {k.nextAction} ({calcStatus(k)})
                              </p>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 9. BEFORE VIEW */}
        {currentView === 'before' && (
          <div className="mt-4">
            <h1 className="font-serif">BEFORE</h1>
            <p className="hand text-lg mb-4">“Because what happens next matters.”</p>

            <div className="card">
              <p className="text-xs text-muted mb-4">
                BEFORE predicts conflicts, expiring commitments, and consequences before they become problems.
              </p>

              {/* Deadline collision check */}
              {(() => {
                const datesGroup: Record<string, Knot[]> = {};
                activeKnots.forEach((k) => {
                  const d = k.dueDate || k.expectedDate;
                  if (d) {
                    datesGroup[d] = datesGroup[d] || [];
                    datesGroup[d].push(k);
                  }
                });

                const conflicts = Object.entries(datesGroup).filter(([_, items]) => items.length > 1);

                return (
                  <div className="space-y-4">
                    {conflicts.map(([dateKey, items]) => (
                      <div key={dateKey} className="conflict">
                        <h2 className="font-serif text-lg font-bold text-navy">
                          Possible conflict: {items.length} Knots require attention on {dateKey}
                        </h2>
                        <p className="text-xs text-gray-700 my-1">
                          You have overlapping responsibilities due on the same day. Resolving or prepping one earlier is
                          recommended.
                        </p>
                        <div className="space-y-1 mt-2">
                          {items.map((k) => (
                            <div
                              key={k.id}
                              className="text-xs font-semibold text-purple-900 cursor-pointer hover:underline"
                              onClick={() => setSelectedKnot(k)}
                            >
                              • {k.title} ({k.threadTitle})
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Stale Lent Items Check */}
                    {activeKnots
                      .filter((k) => k.type === 'LENT_ITEM')
                      .map((k) => (
                        <div key={k.id} className="conflict">
                          <h2 className="font-serif text-lg font-bold text-navy">
                            Approaching consequence: {k.thing || k.title}
                          </h2>
                          <p className="text-xs text-gray-700">
                            Borrowed items left open for over 10 days risk being forgotten or lost.
                          </p>
                          <button
                            className="btn alt text-xs py-1 px-3 mt-2"
                            onClick={() => setSelectedKnot(k)}
                          >
                            Resolve or follow up with {k.person || 'contact'} →
                          </button>
                        </div>
                      ))}

                    {conflicts.length === 0 && activeKnots.every((k) => k.type !== 'LENT_ITEM') && (
                      <div className="empty">
                        <div className="symbol">◌</div>
                        <b>No major conflicts detected.</b>
                        <p>THREAD continuously checks for overlapping deadlines and pending consequences.</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 10. LIFE GRAPH VIEW */}
        {currentView === 'graph' && (
          <div className="mt-4">
            <LifeGraph state={state} onSelectKnot={(knot) => setSelectedKnot(knot)} />
          </div>
        )}

        {/* 11. SETTINGS VIEW */}
        {currentView === 'settings' && (
          <div className="mt-4">
            <h1 className="font-serif">Settings</h1>
            <p className="hand text-lg mb-4">“Your life belongs to you.”</p>

            <div className="card mb-4">
              <h3 className="font-serif text-xl mb-1">Demo Mode (Hackathon Jury Demonstration)</h3>
              <p className="text-xs text-muted mb-4">
                Quickly load the standard hackathon demo scenario or reset data.
              </p>
              <div className="flex gap-3 flex-wrap">
                <button className="btn soft" onClick={handleLoadDemo}>
                  LOAD DEMO SCENARIO
                </button>
                <button className="btn danger" onClick={handleClearData}>
                  CLEAR DEMO DATA
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-600 bg-lav/20 p-3 rounded-xl">
                <b>Demo Scenario includes:</b>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Sid — Teammate</li>
                  <li>Aiman — Sister</li>
                  <li>Thread: Promptothon</li>
                  <li>Knot: Receive PPT from Sid</li>
                  <li>Waiting: Sid → PPT</li>
                  <li>Important date: Aiman’s birthday</li>
                  <li>Deadline: Assignment submission</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3 className="font-serif text-xl mb-1">Data & Privacy</h3>
              <p className="text-xs text-muted mb-4">Export your THREAD continuity graph as a JSON file.</p>
              <button
                className="btn alt"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `thread-data-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}
              >
                Export my data (JSON)
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Drop Anything Modal */}
      <DropModal
        isOpen={isDropModalOpen}
        onClose={() => {
          setIsDropModalOpen(false);
          setAutoStartVoice(false);
        }}
        onSaveKnot={handleSaveKnot}
        onResolveExistingKnot={handleResolveExistingKnot}
        existingKnots={state.knots}
        people={state.people}
        threads={state.threads}
        autoStartVoice={autoStartVoice}
      />

      {/* Knot Detail Modal */}
      <KnotDetailModal
        knot={selectedKnot}
        people={state.people}
        onClose={() => setSelectedKnot(null)}
        onResolve={(id) => handleResolveExistingKnot(id, 'Resolved via Knot detail action')}
        onDelete={handleDeleteKnot}
        onUpdate={handleUpdateKnot}
      />

      {/* Person Modal */}
      <PersonModal
        isOpen={isPersonModalOpen}
        onClose={() => {
          setIsPersonModalOpen(false);
          setPersonToEdit(null);
        }}
        onSave={handleSavePerson}
        personToEdit={personToEdit}
      />

      {/* Date Modal */}
      <DateModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onSave={handleSaveDate}
        people={state.people}
        initialDate={dateModalInitialDate}
      />

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        <button onClick={() => setCurrentView('home')}>
          ⌂<br />
          Home
        </button>
        <button onClick={() => setCurrentView('knots')}>
          ⌘<br />
          Knots
        </button>
        <button onClick={() => setIsDropModalOpen(true)}>
          ＋<br />
          Drop
        </button>
        <button onClick={() => setCurrentView('forgetting')}>
          ✦<br />
          Forgetting?
        </button>
        <button onClick={() => setCurrentView('settings')}>
          ⚙<br />
          Settings
        </button>
      </nav>
    </div>
  );
}
