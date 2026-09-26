import React, { useState } from 'react';
import { Knot, Person } from '../types';

interface KnotDetailModalProps {
  knot: Knot | null;
  people: Person[];
  onClose: () => void;
  onResolve: (knotId: string) => void;
  onDelete: (knotId: string) => void;
  onUpdate: (updatedKnot: Knot) => void;
}

export const KnotDetailModal: React.FC<KnotDetailModalProps> = ({
  knot,
  people,
  onClose,
  onResolve,
  onDelete,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedPerson, setEditedPerson] = useState('');
  const [editedNextAction, setEditedNextAction] = useState('');
  const [editedDueDate, setEditedDueDate] = useState('');
  const [editedThread, setEditedThread] = useState('');

  if (!knot) return null;

  const personObj = people.find((p) => p.id === knot.personId);
  const personName = personObj?.name || knot.person || 'Not specified';
  const isWaiting =
    knot.status === 'WAITING' ||
    ['WAITING', 'COMMITMENT', 'REFUND', 'LENT_ITEM'].includes(knot.type);

  const startEdit = () => {
    setEditedTitle(knot.title);
    setEditedPerson(knot.person || personName);
    setEditedNextAction(knot.nextAction);
    setEditedDueDate(knot.dueDate || knot.expectedDate || '');
    setEditedThread(knot.threadTitle);
    setIsEditing(true);
  };

  const saveEdit = () => {
    onUpdate({
      ...knot,
      title: editedTitle,
      person: editedPerson,
      waitingOn: isWaiting ? editedPerson : knot.waitingOn,
      nextAction: editedNextAction,
      dueDate: editedDueDate || null,
      expectedDate: editedDueDate || null,
      threadTitle: editedThread,
    });
    setIsEditing(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <small className="font-bold tracking-wider text-xs text-muted">KNOT DETAILS</small>
          <button className="text-gray-400 hover:text-navy text-2xl font-bold" onClick={onClose}>
            ×
          </button>
        </div>

        {isEditing ? (
          <div className="my-3">
            <h2 className="mb-3">Edit Knot</h2>
            <div className="field">
              <label>Title</label>
              <input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Person / Contact</label>
              <input value={editedPerson} onChange={(e) => setEditedPerson(e.target.value)} />
            </div>
            <div className="field">
              <label>Next Action</label>
              <input value={editedNextAction} onChange={(e) => setEditedNextAction(e.target.value)} />
            </div>
            <div className="field">
              <label>Expected / Due Date</label>
              <input
                type="date"
                value={editedDueDate}
                onChange={(e) => setEditedDueDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Thread</label>
              <input value={editedThread} onChange={(e) => setEditedThread(e.target.value)} />
            </div>
            <div className="actions">
              <button className="btn alt" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button className="btn" onClick={saveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl mt-1 mb-2 font-serif text-navy">{knot.title}</h2>
            <div className="flex gap-2 items-center mb-4">
              <span className={`pill ${knot.status.toLowerCase()}`}>{knot.status.replace('_', ' ')}</span>
              <span className="pill open">{knot.type.replace('_', ' ')}</span>
              <span className="text-xs text-muted">Created {new Date(knot.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-line text-sm mb-4">
              <div>
                <b className="text-gray-500 text-xs block">What</b>
                <span className="font-semibold text-navy">{knot.title}</span>
              </div>
              <div>
                <b className="text-gray-500 text-xs block">Person</b>
                <span className="font-semibold text-navy">{personName}</span>
              </div>
              <div>
                <b className="text-gray-500 text-xs block">From</b>
                <span>{knot.from || (isWaiting ? personName : 'You')}</span>
              </div>
              <div>
                <b className="text-gray-500 text-xs block">To</b>
                <span>{knot.to || (isWaiting ? 'You' : personName)}</span>
              </div>
              <div>
                <b className="text-gray-500 text-xs block">Waiting on</b>
                <span className="font-bold text-coral">
                  {knot.waitingOn || (isWaiting ? personName : 'You')}
                </span>
              </div>
              <div>
                <b className="text-gray-500 text-xs block">Thread / Lifeloop</b>
                <span className="font-semibold">{knot.threadTitle || 'Personal'}</span>
              </div>
              <div>
                <b className="text-gray-500 text-xs block">Deadline / Expected</b>
                <span>
                  {knot.dueDate || knot.expectedDate
                    ? new Date((knot.dueDate || knot.expectedDate)! + 'T12:00:00').toLocaleDateString(
                        undefined,
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )
                    : 'No specific deadline'}
                </span>
              </div>
              <div>
                <b className="text-gray-500 text-xs block">Confidence</b>
                <span className="font-semibold text-purple-700">{knot.confidence || 'High'}</span>
              </div>
              <div className="col-span-full">
                <b className="text-gray-500 text-xs block">Next action</b>
                <p className="mt-1 text-navy font-medium bg-lav/30 p-2.5 rounded-xl">
                  {knot.nextAction || 'Follow up to resolve this knot'}
                </p>
              </div>
              <div className="col-span-full">
                <b className="text-gray-500 text-xs block">How it will be resolved</b>
                <p className="mt-1 text-gray-700">
                  {knot.resolutionCondition ||
                    (isWaiting
                      ? `When ${personName} completes or delivers the promised item and confirming evidence arrives.`
                      : 'When the necessary step is taken and verified.')}
                </p>
              </div>
              <div className="col-span-full">
                <b className="text-gray-500 text-xs block">Evidence & Source</b>
                <div className="mt-1 space-y-1">
                  {knot.evidence && knot.evidence.length > 0 ? (
                    knot.evidence.map((ev, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded-lg text-xs text-gray-600 border border-gray-100">
                        <b>{ev.source}</b> · <small>{new Date(ev.at).toLocaleString()}</small>
                        {ev.details && <p className="mt-1 italic text-gray-700">“{ev.details}”</p>}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">User entered drop</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                className="btn danger text-xs"
                onClick={() => {
                  if (confirm(`Delete knot "${knot.title}"?`)) {
                    onDelete(knot.id);
                    onClose();
                  }
                }}
              >
                Delete
              </button>

              <div className="flex gap-2">
                <button type="button" className="btn alt" onClick={startEdit}>
                  Edit
                </button>
                {knot.status !== 'RESOLVED' && (
                  <button
                    type="button"
                    className="btn success"
                    onClick={() => {
                      onResolve(knot.id);
                      onClose();
                    }}
                  >
                    Resolve Knot ✓
                  </button>
                )}
                <button type="button" className="btn alt" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
