import React, { useState } from 'react';
import {
  EventQuestion,
  EventQuestionGroup,
  EventQuestionAnswerType,
} from '../../types';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';
import { ConfirmDialog } from '../ConfirmDialog';

interface EventQuestionsManagementProps {
  eventQuestions: EventQuestion[];
  config: Config;
  setEventQuestions: React.Dispatch<React.SetStateAction<EventQuestion[]>>;
}

const GROUPS: EventQuestionGroup[] = [
  'Ceremony',
  'Reception',
  'Lodging',
  'Rehearsal Dinner',
  'Other Activities/Events',
];

const ANSWER_TYPES: { id: EventQuestionAnswerType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'integer', label: 'Number' },
  { id: 'dropdown', label: 'Dropdown' },
];

interface Draft {
  id?: string;
  text: string;
  group: EventQuestionGroup;
  answerType: EventQuestionAnswerType;
  optionsText: string;
  required: boolean;
}

const emptyDraft = (): Draft => ({
  text: '',
  group: 'Ceremony',
  answerType: 'text',
  optionsText: '',
  required: false,
});

/** Validate a draft; returns an error message or null. */
function validate(draft: Draft): string | null {
  if (!draft.text.trim()) return 'Question text is required.';
  if (draft.answerType === 'dropdown') {
    const opts = draft.optionsText.split(',').map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) return 'Dropdown questions need at least 2 options (comma-separated).';
  }
  return null;
}

/**
 * Admin editor for the event questionnaire.
 * Supports add/edit/delete, all groups, text/number/dropdown answer types with
 * comma-separated dropdown options, and a required toggle.
 */
export function EventQuestionsManagement({ eventQuestions, config, setEventQuestions }: EventQuestionsManagementProps) {
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const resetDraft = () => {
    setDraft(emptyDraft());
    setError('');
  };

  const handleSave = () => {
    const err = validate(draft);
    if (err) {
      setError(err);
      return;
    }
    setError('');

    const base = {
      text: draft.text.trim(),
      group: draft.group,
      answerType: draft.answerType,
      required: draft.required,
    };

    if (draft.id) {
      // Edit existing
      setEventQuestions(
        eventQuestions.map((q) =>
          q.id === draft.id
            ? {
                ...q,
                ...base,
                options: draft.answerType === 'dropdown'
                  ? draft.optionsText.split(',').map((o) => o.trim()).filter(Boolean)
                  : undefined,
              }
            : q,
        ),
      );
    } else {
      // Add new
      const q: EventQuestion = {
        id: `eq-${Date.now()}`,
        ...base,
        options: draft.answerType === 'dropdown'
          ? draft.optionsText.split(',').map((o) => o.trim()).filter(Boolean)
          : undefined,
        workflow: [],
      };
      setEventQuestions([...eventQuestions, q]);
    }
    resetDraft();
  };

  const startEdit = (q: EventQuestion) => {
    setDraft({
      id: q.id,
      text: q.text,
      group: q.group,
      answerType: q.answerType,
      optionsText: (q.options || []).join(', '),
      required: q.required === true,
    });
    setError('');
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  return (
    <>
      <div className="space-y-4">
        <BrandedSectionHeader icon="❓" title="Event Questions" description="Dynamic questionnaire that planning users answer to tailor their layouts" config={config} />

      {/* Add/Edit form */}
      <div className="bg-white p-4 rounded-xl border space-y-3">
        <h3 className="font-semibold text-gray-800">{draft.id ? 'Edit Question' : 'Add Question'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Question text"
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            className="border rounded px-3 py-2 md:col-span-2"
          />
          <select
            value={draft.group}
            onChange={(e) => setDraft({ ...draft, group: e.target.value as EventQuestionGroup })}
            className="border rounded px-3 py-2"
          >
            {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={draft.answerType}
            onChange={(e) => setDraft({ ...draft, answerType: e.target.value as EventQuestionAnswerType })}
            className="border rounded px-3 py-2"
          >
            {ANSWER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {draft.answerType === 'dropdown' && (
            <input
              type="text"
              placeholder="Options, comma separated (e.g. Indoor, Outdoor, Both)"
              value={draft.optionsText}
              onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })}
              className="border rounded px-3 py-2 md:col-span-2"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
            />
            Required
          </label>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button onClick={handleSave} className="bg-[#4A1942] text-white rounded px-4 py-2 text-sm font-medium">
            {draft.id ? 'Save Changes' : 'Add Question'}
          </button>
          {draft.id && (
            <button onClick={resetDraft} className="border rounded px-4 py-2 text-sm">Cancel</button>
          )}
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-3">
        {eventQuestions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No questions yet. Add your first question above.</p>
        ) : (
          eventQuestions.map((q) => (
            <div key={q.id} className="bg-white p-4 rounded-xl border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {q.text} {q.required && <span className="text-red-500">*</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-[#4A1942]/10 text-[#4A1942] px-2 py-0.5 rounded">{q.group}</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">{q.answerType}</span>
                    {q.answerType === 'dropdown' && q.options && q.options.length > 0 && (
                      <span className="text-gray-500">{q.options.length} options</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(q)} className="text-gray-500 hover:text-blue-600" aria-label={`Edit ${q.text}`}>✏️</button>
                  <button onClick={() => handleDelete(q.id)} className="text-gray-500 hover:text-red-600" aria-label={`Delete ${q.text}`}>🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete event question"
        message="Are you sure you want to delete this question? Planning users will no longer be asked it."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (deleteTarget) {
            setEventQuestions(eventQuestions.filter((q) => q.id !== deleteTarget));
            if (draft.id === deleteTarget) resetDraft();
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
