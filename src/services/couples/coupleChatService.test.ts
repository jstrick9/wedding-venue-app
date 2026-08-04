import { describe, it, expect, beforeEach } from 'vitest';
import {
  sendCoupleMessage,
  getCoupleMessages,
  getUnreadCoupleMessageCounts,
  getCoupleMessagesForBackup,
} from './coupleChatService';

describe('coupleChatService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends and reads messages scoped to a couple event', () => {
    sendCoupleMessage({ coupleEventId: 'e1', senderId: 'u1', senderName: 'Jane', senderSide: 'couple', message: 'Hello venue!' });
    sendCoupleMessage({ coupleEventId: 'e1', senderId: 'venue', senderName: 'Venue', senderSide: 'venue', message: 'Hi Jane!' });
    sendCoupleMessage({ coupleEventId: 'e2', senderId: 'u2', senderName: 'Other', senderSide: 'couple', message: 'Different event' });

    const e1 = getCoupleMessages('e1');
    expect(e1).toHaveLength(2);
    expect(e1[0].message).toBe('Hello venue!');
    // scoped: e2 not included
    expect(getCoupleMessages('e2')).toHaveLength(1);
    // sorted oldest first
    expect(e1[1].senderSide).toBe('venue');
  });

  it('reports unread counts per event (messages from the couple)', () => {
    sendCoupleMessage({ coupleEventId: 'e1', senderId: 'u1', senderName: 'A', senderSide: 'couple', message: 'hi' });
    sendCoupleMessage({ coupleEventId: 'e1', senderId: 'venue', senderName: 'V', senderSide: 'venue', message: 'hey' });
    sendCoupleMessage({ coupleEventId: 'e2', senderId: 'u2', senderName: 'B', senderSide: 'couple', message: 'yo' });
    const counts = getUnreadCoupleMessageCounts(['e1', 'e2']);
    expect(counts.e1).toBe(1); // only the couple message
    expect(counts.e2).toBe(1);
  });

  it('exposes all messages for backup', () => {
    sendCoupleMessage({ coupleEventId: 'e1', senderId: 'u1', senderName: 'A', senderSide: 'couple', message: 'x' });
    expect(getCoupleMessagesForBackup()).toHaveLength(1);
  });
});
