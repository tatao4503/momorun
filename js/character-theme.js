// 모모런 캐릭터 테마 엔진.
// 캐릭터 파일의 theme 데이터만 읽어 CSS 변수와 로컬 배경 자산을 적용한다.
(() => {
  const root = document.documentElement;
  const CUSTOMIZATION_KEY = 'momo-character-customization-v1';
  const MAX_STORED_IMAGE_LENGTH = 1800000;
  const PACK_FORMAT = 'momorun-character-pack';
  const PACK_VERSION = 1;
  const PACK_SCOPE = 'visual-only';
  const MAX_PACK_TEXT_LENGTH = MAX_STORED_IMAGE_LENGTH + 16384;
  let activeIdentity = null;

  function resolveSurface() {
    return root.dataset.themeSurface || root.dataset.mode || 'schale';
  }

  function safeCssValue(value) {
    if (typeof value !== 'string' || value.length > 160) return '';
    if (/[;{}]|url\s*\(|expression\s*\(|@import/i.test(value)) return '';
    return value.trim();
  }

  function assetUrl(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath.trim()) return '';
    const raw = relativePath.trim();
    if (/^(?:https?:)?\/\//i.test(raw) || /\\/.test(raw) || raw.split('/').includes('..')) return '';
    if (/^data:/i.test(raw) && !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(raw)) return '';
    try {
      const url = new URL(raw, document.baseURI);
      if (!['http:', 'https:', 'file:', 'capacitor:', 'ionic:', 'blob:', 'data:'].includes(url.protocol)) return '';
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function cssUrl(relativePath) {
    const href = assetUrl(relativePath);
    return href ? `url("${href.replace(/"/g, '%22')}")` : '';
  }

  function setVariable(name, value) {
    if (!/^--[a-z][a-z0-9-]*$/i.test(name)) return false;
    const normalized = safeCssValue(value);
    if (!normalized) return false;
    root.style.setProperty(name, normalized);
    return true;
  }

  function setImageVariable(name, relativePath) {
    const value = cssUrl(relativePath);
    if (!value) return false;
    root.style.setProperty(name, value);
    return true;
  }

  function storageAdapter() {
    if (window.NoaCore && window.NoaCore.storage) return window.NoaCore.storage;
    try {
      return window.localStorage;
    } catch (_) {
      return null;
    }
  }

  function customizationStorageKey(character = window.MomoCharacter) {
    const id = String(character?.id || 'noa').toLowerCase();
    return id === 'noa' ? CUSTOMIZATION_KEY : `${CUSTOMIZATION_KEY}:${id}`;
  }

  function normalizeName(value) {
    if (typeof value !== 'string') return '';
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    return Array.from(clean).slice(0, 24).join('');
  }

  function normalizeAccent(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
  }

  function normalizeStoredImage(value) {
    if (typeof value !== 'string' || value.length > MAX_STORED_IMAGE_LENGTH) return '';
    return /^data:image\/(?:png|jpeg|webp);base64,/i.test(value) ? value : '';
  }

  function normalizeCustomization(value) {
    if (!value || typeof value !== 'object') return null;
    const normalized = {
      version: 1,
      name: normalizeName(value.name),
      accent: normalizeAccent(value.accent),
      image: normalizeStoredImage(value.image),
    };
    return normalized.name || normalized.accent || normalized.image ? normalized : null;
  }

  function isPlainRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOnlyKeys(value, allowed) {
    return isPlainRecord(value) && Object.keys(value).every(key => allowed.includes(key));
  }

  function createCharacterPack(value) {
    const customization = normalizeCustomization(value);
    if (!customization || !customization.name || !customization.accent) return null;
    const basePack = String(window.MomoCharacter?.id || 'noa').toLowerCase();
    return {
      format: PACK_FORMAT,
      version: PACK_VERSION,
      scope: PACK_SCOPE,
      character: {
        name: customization.name,
        accent: customization.accent,
        image: customization.image || null,
      },
      meta: {
        app: 'MomoRun',
        createdAt: new Date().toISOString(),
        basePack: /^[a-z0-9-]{1,40}$/.test(basePack) ? basePack : 'noa',
      },
    };
  }

  function serializeCharacterPack(value) {
    const pack = createCharacterPack(value);
    return pack ? JSON.stringify(pack, null, 2) : '';
  }

  function invalidPack(reason, message) {
    return { ok: false, reason, message };
  }

  function parseCharacterPack(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return invalidPack('empty', '비어 있는 팩 파일입니다.');
    }
    if (text.length > MAX_PACK_TEXT_LENGTH) {
      return invalidPack('too-large', '팩 파일이 허용 크기를 넘었습니다.');
    }

    let pack;
    try {
      pack = JSON.parse(text);
    } catch (_) {
      return invalidPack('invalid-json', '올바른 JSON 팩 파일이 아닙니다.');
    }

    if (!hasOnlyKeys(pack, ['format', 'version', 'scope', 'character', 'meta'])) {
      return invalidPack('unknown-field', '허용되지 않은 팩 항목이 포함되어 있습니다.');
    }
    if (pack.format !== PACK_FORMAT || pack.scope !== PACK_SCOPE) {
      return invalidPack('invalid-format', '모모런 시각 캐릭터 팩이 아닙니다.');
    }
    if (pack.version !== PACK_VERSION) {
      return invalidPack('unsupported-version', '지원하지 않는 캐릭터 팩 버전입니다.');
    }
    if (!hasOnlyKeys(pack.character, ['name', 'accent', 'image'])) {
      return invalidPack('invalid-character', '캐릭터 표시 정보의 형식이 올바르지 않습니다.');
    }
    if (!hasOnlyKeys(pack.meta, ['app', 'createdAt', 'basePack'])) {
      return invalidPack('invalid-meta', '캐릭터 팩 메타 정보가 올바르지 않습니다.');
    }

    const name = normalizeName(pack.character.name);
    const accent = normalizeAccent(pack.character.accent);
    const rawImage = pack.character.image;
    const image = rawImage == null ? '' : normalizeStoredImage(rawImage);
    if (!name || name !== pack.character.name) {
      return invalidPack('invalid-name', '표시 이름이 비어 있거나 허용 길이를 넘었습니다.');
    }
    if (!accent) {
      return invalidPack('invalid-accent', '포인트 색상 형식이 올바르지 않습니다.');
    }
    if (rawImage != null && !image) {
      return invalidPack('invalid-image', '팩 이미지는 압축된 JPG, PNG 또는 WebP만 사용할 수 있습니다.');
    }
    if (pack.meta.app !== 'MomoRun'
      || typeof pack.meta.createdAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(pack.meta.createdAt)
      || !/^[a-z0-9-]{1,40}$/.test(pack.meta.basePack || '')) {
      return invalidPack('invalid-meta', '캐릭터 팩 메타 정보가 올바르지 않습니다.');
    }

    return {
      ok: true,
      customization: { version: 1, name, accent, image },
      meta: {
        app: 'MomoRun',
        createdAt: pack.meta.createdAt,
        basePack: pack.meta.basePack,
        scope: PACK_SCOPE,
      },
    };
  }

  function readCustomization() {
    const storage = storageAdapter();
    if (!storage) return null;
    try {
      return normalizeCustomization(JSON.parse(storage.getItem(customizationStorageKey()) || 'null'));
    } catch (_) {
      return null;
    }
  }

  function saveCustomization(value) {
    const customization = normalizeCustomization(value);
    const storage = storageAdapter();
    if (!customization || !storage) return false;
    const payload = JSON.stringify(customization);
    const key = customizationStorageKey();
    if (window.NoaCore && typeof window.NoaCore.safeSet === 'function') {
      return window.NoaCore.safeSet(key, payload);
    }
    try {
      storage.setItem(key, payload);
      return true;
    } catch (_) {
      return false;
    }
  }

  function resetCustomization() {
    const storage = storageAdapter();
    if (!storage) return false;
    try {
      storage.removeItem(customizationStorageKey());
      return true;
    } catch (_) {
      return false;
    }
  }

  function identityFor(character, customization = readCustomization()) {
    const customName = customization && customization.name;
    const name = customName || normalizeName(character && character.name) || '캐릭터';
    const shortName = customName || normalizeName(character && character.shortName) || name;
    const label = customName || normalizeName(character && character.label) || shortName;
    const avatar = (customization && customization.image)
      || assetUrl(character && character.avatar)
      || '';
    return { name, shortName, label, avatar, customized: Boolean(customization) };
  }

  function fillTemplate(template, identity) {
    return String(template || '')
      .replaceAll('{name}', identity.name)
      .replaceAll('{shortName}', identity.shortName)
      .replaceAll('{label}', identity.label);
  }

  function applyIdentity(scope = document, identity = activeIdentity || identityFor(window.MomoCharacter)) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return identity;
    scope.querySelectorAll('[data-character-name]').forEach(element => {
      if (element.textContent !== identity.name) element.textContent = identity.name;
    });
    scope.querySelectorAll('[data-character-short-name]').forEach(element => {
      if (element.textContent !== identity.shortName) element.textContent = identity.shortName;
    });
    scope.querySelectorAll('[data-character-template]').forEach(element => {
      const next = fillTemplate(element.dataset.characterTemplate, identity);
      if (element.textContent !== next) element.textContent = next;
    });
    scope.querySelectorAll('[data-character-placeholder]').forEach(element => {
      const next = fillTemplate(element.dataset.characterPlaceholder, identity);
      if (element.getAttribute('placeholder') !== next) element.setAttribute('placeholder', next);
    });
    scope.querySelectorAll('[data-character-ui]').forEach(element => {
      const value = window.MomoCharacter?.ui?.[element.dataset.characterUi];
      if (typeof value === 'string' && value && element.textContent !== value) element.textContent = value;
    });
    scope.querySelectorAll('[data-character-ui-template]').forEach(element => {
      const value = window.MomoCharacter?.ui?.[element.dataset.characterUiTemplate];
      if (typeof value !== 'string' || !value) return;
      const next = fillTemplate(value, identity);
      if (element.textContent !== next) element.textContent = next;
    });
    scope.querySelectorAll('img[data-character-avatar]').forEach(image => {
      if (identity.avatar && image.getAttribute('src') !== identity.avatar) image.setAttribute('src', identity.avatar);
      if (image.getAttribute('alt') && image.getAttribute('alt') !== identity.name) image.setAttribute('alt', identity.name);
    });
    return identity;
  }

  function apply(character = window.MomoCharacter, customization = readCustomization()) {
    const theme = character && character.theme;
    if (!character || !theme) return null;

    const surfaceName = resolveSurface();
    const surface = theme.surfaces && (theme.surfaces[surfaceName] || theme.surfaces.schale);
    if (!surface) return null;

    root.dataset.character = String(character.id || 'custom');
    Object.entries(surface.variables || {}).forEach(([name, value]) => setVariable(name, value));

    const backgrounds = theme.backgrounds || {};
    const base = backgrounds.default || {};
    setImageVariable('--character-bg-mobile', base.mobile);
    setImageVariable('--character-bg-desktop', base.desktop);

    for (const variant of backgrounds.variants || []) {
      const token = String(variant.className || '').toLowerCase();
      if (!/^theme-[a-z0-9-]+$/.test(token)) continue;
      setImageVariable(`--character-bg-${token}-mobile`, variant.mobile);
      setImageVariable(`--character-bg-${token}-desktop`, variant.desktop);
    }

    for (const [mode, image] of Object.entries(backgrounds.modeCards || {})) {
      const token = String(mode).toLowerCase();
      if (!/^[a-z0-9-]+$/.test(token)) continue;
      setImageVariable(`--character-mode-card-${token}`, image);
    }

    if (customization && customization.accent) {
      for (const name of surface.customAccentVariables || []) setVariable(name, customization.accent);
    }

    if (customization && customization.image) {
      setImageVariable('--character-bg-mobile', customization.image);
      setImageVariable('--character-bg-desktop', customization.image);
      for (const variant of backgrounds.variants || []) {
        const token = String(variant.className || '').toLowerCase();
        if (!/^theme-[a-z0-9-]+$/.test(token)) continue;
        setImageVariable(`--character-bg-${token}-mobile`, customization.image);
        setImageVariable(`--character-bg-${token}-desktop`, customization.image);
      }
      for (const mode of Object.keys(backgrounds.modeCards || {})) {
        const token = String(mode).toLowerCase();
        if (/^[a-z0-9-]+$/.test(token)) setImageVariable(`--character-mode-card-${token}`, customization.image);
      }
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    const metaThemeColor = safeCssValue((customization && customization.accent) || surface.metaThemeColor);
    if (meta && metaThemeColor) meta.setAttribute('content', metaThemeColor);

    activeIdentity = identityFor(character, customization);
    applyIdentity(document, activeIdentity);

    const result = {
      characterId: root.dataset.character,
      surface: surfaceName,
      customized: activeIdentity.customized,
    };
    if (typeof window.CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('momorun:theme-applied', { detail: result }));
    }
    return result;
  }

  window.MomoTheme = {
    CUSTOMIZATION_KEY,
    MAX_PACK_TEXT_LENGTH,
    MAX_STORED_IMAGE_LENGTH,
    PACK_FORMAT,
    PACK_SCOPE,
    PACK_VERSION,
    apply,
    applyIdentity,
    assetUrl,
    createCharacterPack,
    getCustomizationKey: customizationStorageKey,
    getCustomization: readCustomization,
    getIdentity: () => activeIdentity || identityFor(window.MomoCharacter),
    parseCharacterPack,
    resetCustomization,
    resolveSurface,
    saveCustomization,
    serializeCharacterPack,
  };
  apply();
})();
