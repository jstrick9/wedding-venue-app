export type CollaborationEvent =
  | {
      type: 'layout-saved';
      layoutId: string;
      revision: number;
      actorName?: string;
    }
  | {
      type: 'layout-session-started';
      layoutId: string;
      editorId: string;
      editorName: string;
    }
  | {
      type: 'layout-session-ended';
      layoutId: string;
      editorId: string;
    };

const CHANNEL_NAME = 'spm-collaboration';

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

export function publishCollaborationEvent(event: CollaborationEvent): void {
  const channel = getChannel();
  if (!channel) return;

  channel.postMessage(event);
  channel.close();
}

export function subscribeToCollaborationEvents(
  handler: (event: CollaborationEvent) => void,
): () => void {
  const channel = getChannel();
  if (!channel) return () => undefined;

  const listener = (message: MessageEvent<CollaborationEvent>) => {
    handler(message.data);
  };

  channel.addEventListener('message', listener);

  return () => {
    channel.removeEventListener('message', listener);
    channel.close();
  };
}