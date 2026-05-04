import { useEffect, useMemo, useState } from 'react';
import type { EventAnswer } from '../types';
import type { EventSubmission, SubmissionStatus } from '../models/SubmissionWorkflow';
import { buildSubmissionKey } from '../models/SubmissionWorkflow';

const STORAGE_KEY = 'spm_event_submissions_v1';

interface SubmitPayload {
  eventName: string;
  masterUserId: string;
  masterUserName: string;
  selectedVenueIds: string[];
  answers: EventAnswer[];
}

export function useSubmissionWorkflow() {
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as EventSubmission[];
      if (Array.isArray(parsed)) setSubmissions(parsed);
    } catch {
      // ignore corrupted local storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  }, [submissions]);

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === 'pending').length,
    [submissions],
  );

  const getByMasterAndEvent = (masterUserId: string, eventName: string) =>
    submissions.find((s) => buildSubmissionKey(s.eventName, s.masterUserId) === buildSubmissionKey(eventName, masterUserId)) || null;

  const submit = ({ eventName, masterUserId, masterUserName, selectedVenueIds, answers }: SubmitPayload) => {
    const now = new Date().toISOString();
    setSubmissions((prev) => {
      const existing = prev.find(
        (s) => buildSubmissionKey(s.eventName, s.masterUserId) === buildSubmissionKey(eventName, masterUserId),
      );

      if (!existing) {
        const next: EventSubmission = {
          id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          eventName,
          masterUserId,
          masterUserName,
          selectedVenueIds,
          answers,
          status: 'pending',
          submittedAt: now,
          updatedAt: now,
          history: [],
        };
        return [next, ...prev];
      }

      return prev.map((s) =>
        s.id === existing.id
          ? {
              ...s,
              selectedVenueIds,
              answers,
              status: 'pending',
              updatedAt: now,
            }
          : s,
      );
    });
  };

  const review = (
    submissionId: string,
    action: 'approve' | 'request_changes' | 'reject',
    reviewerUserId: string,
    reviewerName: string,
    comment?: string,
  ) => {
    const statusMap: Record<typeof action, SubmissionStatus> = {
      approve: 'approved',
      request_changes: 'changes_requested',
      reject: 'rejected',
    };
    const now = new Date().toISOString();

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              status: statusMap[action],
              adminComment: comment?.trim() || undefined,
              updatedAt: now,
              history: [
                ...s.history,
                {
                  action,
                  byUserId: reviewerUserId,
                  byName: reviewerName,
                  comment: comment?.trim() || undefined,
                  at: now,
                },
              ],
            }
          : s,
      ),
    );
  };

  return {
    submissions,
    pendingCount,
    getByMasterAndEvent,
    submit,
    review,
  };
}
