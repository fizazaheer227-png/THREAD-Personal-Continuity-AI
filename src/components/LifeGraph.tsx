import React, { useState } from 'react';
import { AppState, Person, Knot } from '../types';

interface LifeGraphProps {
  state: AppState;
  onSelectKnot: (knot: Knot) => void;
}

export const LifeGraph: React.FC<LifeGraphProps> = ({ state, onSelectKnot }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('YOU');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const activeKnots = state.knots.filter((k) => k.status !== 'RESOLVED');
  const waitingKnots = state.knots.filter(
    (k) =>
      k.status !== 'RESOLVED' &&
      (k.status === 'WAITING' || ['WAITING', 'COMMITMENT', 'REFUND', 'LENT_ITEM'].includes(k.type))
  );
  const thingsKnots = state.knots.filter((k) => k.thing || k.type === 'LENT_ITEM');

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="font-serif">Life Graph</h1>
        <span className="text-xs text-muted">Click any node to explore connections</span>
      </div>
      <p className="hand text-lg mb-4">“Your life isn't a list. Everything connects.”</p>

      {/* Interactive Visual Graph Canvas */}
      <div className="card graph relative mb-4 flex items-center justify-center p-6">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Connecting bezier threads */}
          <path d="M 50% 50% Q 25% 30% 18% 20%" stroke="#a9b8ff" strokeWidth="2.5" fill="none" opacity="0.75" />
          <path d="M 50% 50% Q 75% 28% 82% 20%" stroke="#e8b6cf" strokeWidth="2.5" fill="none" opacity="0.75" />
          <path d="M 50% 50% Q 22% 65% 16% 80%" stroke="#9ed7bb" strokeWidth="2.5" fill="none" opacity="0.75" />
          <path d="M 50% 50% Q 78% 68% 84% 80%" stroke="#f7c995" strokeWidth="2.5" fill="none" opacity="0.75" />
          <path d="M 50% 50% Q 50% 25% 50% 12%" stroke="#f5e5a5" strokeWidth="2.5" fill="none" opacity="0.75" />
          <path d="M 50% 50% Q 50% 75% 50% 88%" stroke="#cfe3f6" strokeWidth="2.5" fill="none" opacity="0.75" />
        </svg>

        {/* Center: YOU */}
        <div
          className={`node center ${selectedCategory === 'YOU' ? 'ring-4 ring-purple-400 scale-110' : ''}`}
          onClick={() => {
            setSelectedCategory('YOU');
            setSelectedPerson(null);
          }}
        >
          YOU
        </div>

        {/* Node 1: People */}
        <div
          className={`node n1 ${selectedCategory === 'People' ? 'ring-4 ring-blue-400 scale-105' : ''}`}
          onClick={() => {
            setSelectedCategory('People');
            setSelectedPerson(null);
          }}
        >
          People ({state.people.length})
        </div>

        {/* Node 2: Threads */}
        <div
          className={`node n2 ${selectedCategory === 'Threads' ? 'ring-4 ring-purple-400 scale-105' : ''}`}
          onClick={() => {
            setSelectedCategory('Threads');
            setSelectedPerson(null);
          }}
        >
          Threads ({state.threads.length})
        </div>

        {/* Node 3: Waiting */}
        <div
          className={`node n3 ${selectedCategory === 'Waiting' ? 'ring-4 ring-green-400 scale-105' : ''}`}
          onClick={() => {
            setSelectedCategory('Waiting');
            setSelectedPerson(null);
          }}
        >
          Waiting ({waitingKnots.length})
        </div>

        {/* Node 4: Evidence */}
        <div
          className={`node n4 ${selectedCategory === 'Evidence' ? 'ring-4 ring-orange-400 scale-105' : ''}`}
          onClick={() => {
            setSelectedCategory('Evidence');
            setSelectedPerson(null);
          }}
        >
          Evidence
        </div>

        {/* Node 5: Knots */}
        <div
          className={`node n5 ${selectedCategory === 'Knots' ? 'ring-4 ring-yellow-400 scale-105' : ''}`}
          onClick={() => {
            setSelectedCategory('Knots');
            setSelectedPerson(null);
          }}
        >
          Knots ({activeKnots.length})
        </div>

        {/* Node 6: Things / Lent */}
        <div
          className={`node n6 ${selectedCategory === 'Things' ? 'ring-4 ring-amber-400 scale-105' : ''}`}
          onClick={() => {
            setSelectedCategory('Things');
            setSelectedPerson(null);
          }}
        >
          Things ({thingsKnots.length})
        </div>
      </div>

      {/* Detail Inspector Panel */}
      <div className="card mt-4">
        {selectedCategory === 'YOU' && (
          <div>
            <h3 className="font-serif text-xl mb-1">About You ({state.user?.name || 'User'})</h3>
            <p className="text-muted text-sm mb-4">Everything THREAD knows and connects across your life.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-lav/30 rounded-xl">
                <small className="text-muted block">Role / Program</small>
                <b>{state.user?.role || 'Student'}</b> · <small>{state.user?.college || 'Computing'}</small>
              </div>
              <div className="p-3 bg-pink/30 rounded-xl">
                <small className="text-muted block">People Connected</small>
                <b className="text-xl">{state.people.length}</b>
              </div>
              <div className="p-3 bg-mint/40 rounded-xl">
                <small className="text-muted block">Active Lifeloops</small>
                <b className="text-xl">{state.threads.length}</b>
              </div>
              <div className="p-3 bg-blue/30 rounded-xl">
                <small className="text-muted block">Things Waiting</small>
                <b className="text-xl">{waitingKnots.length}</b>
              </div>
            </div>
            <h4 className="font-bold text-sm mb-2">Connected Threads & Knots:</h4>
            <div className="knot-list">
              {activeKnots.map((k) => (
                <div key={k.id} className="knot cursor-pointer" onClick={() => onSelectKnot(k)}>
                  <div>
                    <b>{k.title}</b>
                    <br />
                    <small className="text-muted">
                      {k.threadTitle} {k.person ? `· ${k.person}` : ''} {k.dueDate ? `· Due ${k.dueDate}` : ''}
                    </small>
                  </div>
                  <span className={`pill ${k.status.toLowerCase()}`}>{k.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedCategory === 'People' && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-serif text-xl">People in your World</h3>
              {selectedPerson && (
                <button className="text-xs text-purple-700 underline" onClick={() => setSelectedPerson(null)}>
                  ← Show all people
                </button>
              )}
            </div>

            {selectedPerson ? (
              <div className="p-4 bg-white rounded-2xl border border-line">
                <div className="flex items-center gap-3 mb-3">
                  <div className="avatar">{selectedPerson.name[0]}</div>
                  <div>
                    <h3 className="text-lg font-bold">{selectedPerson.name}</h3>
                    <small className="text-muted">{selectedPerson.relationship}</small>
                  </div>
                </div>
                {selectedPerson.notes && (
                  <p className="text-sm bg-lav/20 p-2.5 rounded-xl mb-3">
                    <b>Context:</b> {selectedPerson.notes}
                  </p>
                )}
                <h4 className="font-bold text-sm mb-2">Knots connected to {selectedPerson.name}:</h4>
                <div className="knot-list">
                  {state.knots
                    .filter((k) => k.personId === selectedPerson.id || k.person?.toLowerCase() === selectedPerson.name.toLowerCase())
                    .map((k) => (
                      <div key={k.id} className="knot cursor-pointer" onClick={() => onSelectKnot(k)}>
                        <div>
                          <b>{k.title}</b>
                          <br />
                          <small className="text-muted">{k.nextAction}</small>
                        </div>
                        <span className={`pill ${k.status.toLowerCase()}`}>{k.status}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {state.people.map((p) => {
                  const pKnots = state.knots.filter(
                    (k) => k.personId === p.id || k.person?.toLowerCase() === p.name.toLowerCase()
                  );
                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-xl border border-line hover:border-purple-300 cursor-pointer"
                      onClick={() => setSelectedPerson(p)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="avatar w-8 h-8 text-sm">{p.name[0]}</div>
                        <div>
                          <b>{p.name}</b>
                          <small className="text-muted block text-xs">{p.relationship}</small>
                        </div>
                      </div>
                      <small className="text-xs text-purple-800 font-semibold">{pKnots.length} connected Knots →</small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedCategory === 'Waiting' && (
          <div>
            <h3 className="font-serif text-xl mb-1">Waiting Room</h3>
            <p className="text-muted text-sm mb-4">
              Things where the next action belongs to someone or something else.
            </p>
            <div className="knot-list">
              {waitingKnots.map((k) => (
                <div key={k.id} className="knot cursor-pointer" onClick={() => onSelectKnot(k)}>
                  <div>
                    <b>
                      {k.waitingOn || k.person || 'Someone'} → {k.thing || k.title}
                    </b>
                    <br />
                    <small className="text-muted">
                      Expected: {k.dueDate || k.expectedDate || 'Soon'} · Next: {k.nextAction}
                    </small>
                  </div>
                  <span className="pill waiting">WAITING</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedCategory === 'Things' && (
          <div>
            <h3 className="font-serif text-xl mb-1">Things & Items</h3>
            <p className="text-muted text-sm mb-4">Lent items, physical belongings, warranties, and repairs.</p>
            <div className="knot-list">
              {thingsKnots.map((k) => (
                <div key={k.id} className="knot cursor-pointer" onClick={() => onSelectKnot(k)}>
                  <div>
                    <b>{k.title}</b>
                    <br />
                    <small className="text-muted">
                      {k.thing ? `Item: ${k.thing} · ` : ''}
                      {k.person ? `With: ${k.person} · ` : ''}
                      {k.nextAction}
                    </small>
                  </div>
                  <span className={`pill ${k.status.toLowerCase()}`}>{k.type.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedCategory === 'Evidence' && (
          <div>
            <h3 className="font-serif text-xl mb-1">Evidence Trail</h3>
            <p className="text-muted text-sm mb-4">Screenshots, chats, and documents that created your Knots.</p>
            <div className="space-y-3">
              {state.knots
                .filter((k) => k.evidence && k.evidence.length > 0)
                .map((k) => (
                  <div
                    key={k.id}
                    className="p-3 bg-white rounded-xl border border-line cursor-pointer hover:border-purple-300"
                    onClick={() => onSelectKnot(k)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <b className="text-navy">{k.title}</b>
                      <span className="text-xs text-muted">Knot ID: {k.id.slice(0, 8)}</span>
                    </div>
                    {k.evidence.map((ev, i) => (
                      <p key={i} className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg mt-1">
                        <b>{ev.source}</b> ({new Date(ev.at).toLocaleDateString()}): {ev.details || 'Captured via Drop'}
                      </p>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        )}

        {selectedCategory === 'Threads' && (
          <div>
            <h3 className="font-serif text-xl mb-1">Threads (Lifeloops)</h3>
            <div className="space-y-3 mt-3">
              {state.threads.map((t) => {
                const tKnots = state.knots.filter((k) => k.threadId === t.id);
                const resolved = tKnots.filter((k) => k.status === 'RESOLVED').length;
                const pct = tKnots.length ? Math.round((resolved / tKnots.length) * 100) : 0;
                return (
                  <div key={t.id} className="p-3 bg-white rounded-xl border border-line">
                    <div className="flex justify-between items-center mb-2">
                      <b className="font-serif text-lg">{t.title}</b>
                      <span className="pill">{pct}% resolved</span>
                    </div>
                    <div className="progress-track mb-2">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <small className="text-muted">
                      {resolved} of {tKnots.length} Knots resolved
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedCategory === 'Knots' && (
          <div>
            <h3 className="font-serif text-xl mb-3">All Active Knots</h3>
            <div className="knot-list">
              {activeKnots.map((k) => (
                <div key={k.id} className="knot cursor-pointer" onClick={() => onSelectKnot(k)}>
                  <div>
                    <b>{k.title}</b>
                    <br />
                    <small className="text-muted">
                      {k.threadTitle} {k.dueDate ? `· Due ${k.dueDate}` : ''} · {k.nextAction}
                    </small>
                  </div>
                  <span className={`pill ${k.status.toLowerCase()}`}>{k.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
