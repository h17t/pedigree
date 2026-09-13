import { useT } from '@/i18n';
import { usePwa } from '@/pwa/pwaStore';
import { announce } from '../status';

/** "Install on this device": the native prompt where the browser offers one, instructions elsewhere. */
export function InstallPanel() {
  const { t } = useT();
  const standalone = usePwa((s) => s.standalone);
  const canPrompt = usePwa((s) => s.canPrompt);
  const platform = usePwa((s) => s.platform);
  const promptInstall = usePwa((s) => s.promptInstall);
  return (
    <section className="panel section" aria-labelledby="sec-install">
      <h3 id="sec-install">{t('pwa.installTitle')}</h3>
      {standalone ? (
        <p>{t('pwa.installed')}</p>
      ) : (
        <>
          <p>{t('pwa.installBody')}</p>
          {canPrompt ? (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void promptInstall().then((r) => {
                    if (r === 'accepted') announce(t('pwa.installAccepted'));
                    else if (r === 'dismissed') announce(t('pwa.installDismissed'));
                  });
                }}
              >
                {t('pwa.installButton')}
              </button>
            </div>
          ) : (
            <p className="hint">{platform === 'ios' ? t('pwa.installIos') : t('pwa.installOther')}</p>
          )}
        </>
      )}
    </section>
  );
}
