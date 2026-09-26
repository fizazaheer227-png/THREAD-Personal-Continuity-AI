import React, { useState } from 'react';
import { ImportantDate, Person } from '../types';

interface DateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dateItem: Partial<ImportantDate>) => void;
  people: Person[];
  initialDate?: string;
}

export const DateModal: React.FC<DateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  people,
  initialDate = '',
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ImportantDate['type']>('important');
  const [date, setDate] = useState(initialDate);
  const [personId, setPersonId] = useState('');
  const [reminderDays, setReminderDays] = useState('1');
  const [customDays, setCustomDays] = useState('2');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      alert('Please enter title and date.');
      return;
    }
    const days = reminderDays === 'custom' ? parseInt(customDays, 10) || 0 : parseInt(reminderDays, 10) || 0;
    onSave({
      title: title.trim(),
      type,
      date,
      personId: personId || null,
      reminderDays: days,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <h2>Mark an Important Date</h2>
          <button className="text-gray-400 hover:text-navy text-2xl font-bold" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="hand text-lg mb-4">“Some dates deserve a place in your THREAD.”</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>What is it? *</label>
            <input
              required
              placeholder="e.g. Aiman’s birthday, College fest, Exam submission"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="important">Important date</option>
              <option value="birthday">Birthday</option>
              <option value="occasion">Occasion</option>
              <option value="deadline">Deadline</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>
          <div className="field">
            <label>Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Person (optional)</label>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">No person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.relationship})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Remind me</label>
            <select value={reminderDays} onChange={(e) => setReminderDays(e.target.value)}>
              <option value="0">On the day</option>
              <option value="1">1 day before</option>
              <option value="3">3 days before</option>
              <option value="7">1 week before</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {reminderDays === 'custom' && (
            <div className="field">
              <label>Days before</label>
              <input
                type="number"
                min="0"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label>Note (optional)</label>
            <input
              placeholder="Anything THREAD should remember..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="actions">
            <button type="button" className="btn alt" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Save Date + Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
