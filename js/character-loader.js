// 등록된 기본 캐릭터팩 중 사용자가 고른 하나를 활성화한다.
(() => {
  const C = window.NoaCore;
  const catalog = window.MomoCharacterCatalog || {};
  const STORAGE_KEY = 'momo-base-pack-v1';
  const DEFAULT_PACK = 'noa';
  const root = document.documentElement;
  const validIds = Object.keys(catalog).filter(id => /^[a-z0-9-]{1,40}$/.test(id));

  function readSelected() {
    const saved = C?.storage?.getItem(STORAGE_KEY) || '';
    return validIds.includes(saved) ? saved : DEFAULT_PACK;
  }

  function rememberSelected(id) {
    if (!validIds.includes(id)) return false;
    const saved = typeof C?.safeSet === 'function'
      ? C.safeSet(STORAGE_KEY, id)
      : C?.storage?.setItem(STORAGE_KEY, id);
    return saved !== false;
  }

  function applyPackAvailability(id) {
    document.querySelectorAll('[data-base-pack-target]').forEach(button => {
      const active = button.dataset.basePackTarget === id;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
    });

    const fullCard = document.querySelector('[data-mode-card="schale"]');
    if (!fullCard) return;
    const available = (catalog[id]?.availability || []).includes('schale');
    fullCard.classList.toggle('pack-unavailable', !available);
    const action = fullCard.querySelector('.mode-action');
    const label = action?.querySelector('span');
    if (action) {
      if (available) {
        action.href = 'index.html?mode=schale';
        action.removeAttribute('aria-disabled');
      } else {
        action.removeAttribute('href');
        action.setAttribute('aria-disabled', 'true');
      }
    }
    if (label) label.textContent = available ? '샬레로 시작' : '노아 팬팩 전용';
  }

  function select(id) {
    if (!rememberSelected(id)) return false;
    if (!(catalog[id]?.availability || []).includes('schale')) {
      window.NoaModeRouter?.rememberMode?.('life');
    }
    window.location.reload();
    return true;
  }

  const selectedId = readSelected();
  const selected = catalog[selectedId] || catalog[DEFAULT_PACK] || window.MomoCharacter;
  if (!selected) return;

  window.MomoCharacter = selected;
  root.dataset.basePack = selected.id;

  const surface = root.dataset.themeSurface || '';
  if ((surface === 'schale' || surface === 'adventure')
    && !(selected.availability || []).includes(surface)) {
    // 조용히 튕기지 않고, 일상 버전에서 이유를 안내하도록 사유를 전달한다.
    window.location.replace(`life.html?blocked=${encodeURIComponent(surface)}`);
    return;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-base-pack-target]');
    if (button) select(button.dataset.basePackTarget || '');
  });

  document.addEventListener('DOMContentLoaded', () => applyPackAvailability(selected.id));

  window.MomoCharacterLoader = {
    catalog,
    getSelectedId: () => selected.id,
    readSelected,
    select,
    storageKey: STORAGE_KEY,
  };
})();
