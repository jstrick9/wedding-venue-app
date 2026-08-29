import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PlatformVenueChatPanel hang guards', () => {
  it('times out chat load and send', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/PlatformVenueChatPanel.tsx'), 'utf8');
    expect(source).toContain('Loading chat timed out');
    expect(source).toContain('Sending the message timed out');
    expect(source).toContain('listPlatformVenueMessages');
    expect(source).toContain('sendPlatformVenueMessage');
    expect(source).toContain('withTimeout');
    expect(source).toContain('loadInFlight');
  });
});
