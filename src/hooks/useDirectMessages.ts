import { useEffect, useMemo, useState } from 'react';
import type { DirectMessage, MessageRole } from '../models/DirectMessage';

const STORAGE_KEY = 'spm_direct_messages_v1';

type SendMessagePayload = {
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: MessageRole;
  message: string;
};

export function useDirectMessages() {
  const [messages, setMessages] = useState<DirectMessage[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DirectMessage[];
      if (Array.isArray(parsed)) setMessages(parsed);
    } catch {
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const sendMessage = (payload: SendMessagePayload) => {
    const text = payload.message.trim();
    if (!text) return;

    const recipientRole: MessageRole = payload.senderRole === 'admin' ? 'master' : 'admin';

    const next: DirectMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      threadId: payload.threadId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      senderRole: payload.senderRole,
      recipientRole,
      message: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, next]);
  };

  const getThreadMessages = (threadId: string): DirectMessage[] => {
    return messages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const unreadCountForRole = (threadId: string, role: MessageRole): number => {
    return messages.filter((m) => m.threadId === threadId && m.recipientRole === role).length;
  };

  return useMemo(
    () => ({
      messages,
      sendMessage,
      getThreadMessages,
      unreadCountForRole,
    }),
    [messages],
  );
}
