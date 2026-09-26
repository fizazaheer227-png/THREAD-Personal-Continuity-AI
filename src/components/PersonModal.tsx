import React, { useState } from 'react';
import { Person } from '../types';

interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: Partial<Person>) => void;
  personToEdit?: Person | null;
}

export const PersonModal: React.FC<PersonModalProps> = ({
  isOpen,
  onClose,
  onSave,
  personToEdit,
}) => {
  const [name, setName] = useState(personToEdit?.name || '');
  const [relationship, setRelationship] = useState(personToEdit?.relationship || '');
  const [birthday, setBirthday] = useState(personToEdit?.birthday || '');
  const [notes, setNotes] = useState(personToEdit?.notes || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a name.');
      return;
    }
    onSave({
      id: personToEdit?.id,
      name: name.trim(),
      relationship: relationship.trim() || 'Connection',
      birthday: birthday || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <h2>{personToEdit ? 'Edit Person' : 'Add Person'}</h2>
          <button className="text-gray-400 hover:text-navy text-2xl font-bold" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="hand text-lg mb-4">“The people behind your Knots.”</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Name *</label>
            <input
              required
              placeholder="e.g. Aiman, Sid, Venkat"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Relationship</label>
            <input
              placeholder="e.g. Sister, Teammate, Project Lead"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Birthday (optional)</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Important Notes & Context (optional)</label>
            <textarea
              rows={3}
              placeholder="Preferences, promises, context you want THREAD to remember..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="actions">
            <button type="button" className="btn alt" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Save Person
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
