import { describe, it, expect, beforeEach } from 'vitest';
import { usePwa, detectPlatform, listenToBrowser } from '@/pwa/pwaStore';

describe('pwa store', () => {
  beforeEach(() => {
    usePwa.setState({ needRefresh: false, offlineReady: false, canPrompt: false, standalone: false, online: true });
  });

  it('detects iOS from the user agent', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Chrome/128')).toBe('other');
  });

  it('a waiting version is only applied when the user asks', async () => {
    let applied = false;
    usePwa.setState({ update: () => Promise.resolve().then(() => void (applied = true)) });
    usePwa.setState({ needRefresh: true });
    expect(applied).toBe(false);
    usePwa.getState().dismissRefresh();
    expect(usePwa.getState().needRefresh).toBe(false);
    expect(applied).toBe(false);
    await usePwa.getState().update();
    expect(applied).toBe(true);
  });

  it('captures the browser install prompt and reports the choice', async () => {
    listenToBrowser();
    expect(await usePwa.getState().promptInstall()).toBe('unavailable');
    const ev = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' }> };
    let prompted = false;
    ev.prompt = () => Promise.resolve().then(() => void (prompted = true));
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(ev);
    expect(usePwa.getState().canPrompt).toBe(true);
    expect(await usePwa.getState().promptInstall()).toBe('accepted');
    expect(prompted).toBe(true);
    expect(usePwa.getState().canPrompt).toBe(false);
    expect(usePwa.getState().standalone).toBe(true);
  });

  it('tracks the connection state', () => {
    window.dispatchEvent(new Event('offline'));
    expect(usePwa.getState().online).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(usePwa.getState().online).toBe(true);
  });
});
