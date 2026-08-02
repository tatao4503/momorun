(() => {
  const STORAGE_KEY = 'noa-app-mode';
  const VALID_MODES = new Set(['schale', 'lite', 'life']);
  const ROUTES = {
    schale: 'index.html?mode=schale',
    lite: 'momotalk.html',
    life: 'life.html',
  };

  function readMode() {
    try {
      const mode = window.localStorage.getItem(STORAGE_KEY);
      return VALID_MODES.has(mode) ? mode : '';
    } catch (_) {
      return '';
    }
  }

  function rememberMode(mode) {
    if (!VALID_MODES.has(mode)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) {
      // Version switching still works when persistent storage is unavailable.
    }
  }

  function isNativeApp() {
    const capacitor = window.Capacitor;
    return window.location.protocol === 'capacitor:'
      || Boolean(capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform());
  }

  const pageMode = document.documentElement.dataset.mode || '';
  const params = new URLSearchParams(window.location.search);
  const schaleWasRequested = params.get('mode') === 'schale' || params.has('full');
  const nativeRuntime = isNativeApp();
  document.documentElement.classList.toggle('native-app', nativeRuntime);

  if (pageMode === 'schale' && nativeRuntime && !schaleWasRequested) {
    const savedMode = readMode();
    window.location.replace(savedMode ? ROUTES[savedMode] : 'modes.html');
    return;
  }

  if (VALID_MODES.has(pageMode)) rememberMode(pageMode);

  document.addEventListener('click', event => {
    const link = event.target.closest('[data-mode-target]');
    if (!link) return;
    rememberMode(link.dataset.modeTarget || '');
  });

  document.addEventListener('DOMContentLoaded', () => {
    const activeMode = readMode();
    document.querySelectorAll('[data-mode-card]').forEach(card => {
      const isActive = card.dataset.modeCard === activeMode;
      card.classList.toggle('is-current', isActive);
      const status = card.querySelector('[data-mode-status]');
      if (status) status.textContent = isActive ? '현재 선택' : '';
    });
  });

  window.NoaModeRouter = { readMode, rememberMode, routes: ROUTES };
})();
