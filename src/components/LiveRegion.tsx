import React, { useEffect, useState } from 'react';

let listeners: Array<(message: string) => void> = [];

export function announce(message: string) {
  listeners.forEach((listener) => listener(message));
}

export const LiveRegion: React.FC = () => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    listeners.push(setMessage);

    return () => {
      listeners = listeners.filter((listener) => listener !== setMessage);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};

export default LiveRegion;