/**
 * Service-worker registration (production only). The worker precaches the build; a new
 * version waits until the user chooses to reload, so an edit in progress is never interrupted.
 */
import { registerSW } from 'virtual:pwa-register';
import { usePwa, listenToBrowser } from './pwaStore';

export function registerApp(): void {
  listenToBrowser();
  if (!('serviceWorker' in navigator)) return;
  const update = registerSW({
    immediate: true,
    onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
    onOfflineReady: () => usePwa.setState({ offlineReady: true }),
    onRegisterError: () => {
      /* No service worker (e.g. an insecure origin): the app still works, only not offline. */
    },
  });
  usePwa.setState({ update: () => update(true) });
}
