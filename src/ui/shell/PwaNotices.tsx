import { useT } from '@/i18n';
import { usePwa } from '@/pwa/pwaStore';

/**
 * Update and offline notices, shown on every screen (with or without an open tree). The
 * update never applies itself: the user chooses "Reload now" when it suits them.
 */
export function PwaNotices() {
  const { t } = useT();
  const needRefresh = usePwa((s) => s.needRefresh);
  const offlineReady = usePwa((s) => s.offlineReady);
  const online = usePwa((s) => s.online);
  const update = usePwa((s) => s.update);
  const dismissRefresh = usePwa((s) => s.dismissRefresh);
  const dismissOfflineReady = usePwa((s) => s.dismissOfflineReady);
  if (!needRefresh && !offlineReady && online) return null;
  return (
    <div className="banners">
      {needRefresh && (
        <section className="notice notice-info" aria-labelledby="pwa-update-title">
          <p className="notice-title" id="pwa-update-title">
            {t('pwa.updateTitle')}
          </p>
          <p>{t('pwa.updateBody')}</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => void update()}>
              {t('pwa.reload')}
            </button>
            <button type="button" className="btn" onClick={dismissRefresh}>
              {t('pwa.later')}
            </button>
          </div>
        </section>
      )}
      {offlineReady && (
        <section className="notice notice-info" role="status">
          <p>{t('pwa.offlineReady')}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={dismissOfflineReady}>
              {t('common.dismiss')}
            </button>
          </div>
        </section>
      )}
      {!online && (
        <section className="notice" role="status">
          <p>{t('pwa.offlineNote')}</p>
        </section>
      )}
    </div>
  );
}
