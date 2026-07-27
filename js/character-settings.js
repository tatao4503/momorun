// 버전 선택 화면의 로컬 캐릭터 설정 UI.
(() => {
  const $ = id => document.getElementById(id);
  const theme = window.MomoTheme;
  const character = window.MomoCharacter;
  if (!theme || !character) return;

  const els = {
    open: $('characterSettingsOpen'),
    modal: $('characterSettingsModal'),
    dialog: $('characterSettingsDialog'),
    close: $('characterSettingsClose'),
    form: $('characterSettingsForm'),
    name: $('characterNameInput'),
    color: $('characterColorInput'),
    swatches: $('characterColorSwatches'),
    imageInput: $('characterImageInput'),
    imageChoose: $('characterImageChoose'),
    imageRemove: $('characterImageRemove'),
    previewImage: $('characterPreviewImage'),
    previewName: $('characterPreviewName'),
    previewStatus: $('characterPreviewStatus'),
    packExport: $('characterPackExport'),
    packImport: $('characterPackImport'),
    packInput: $('characterPackInput'),
    packStatus: $('characterPackStatus'),
    reset: $('characterSettingsReset'),
    save: $('characterSettingsSave'),
    toast: $('characterSettingsToast'),
  };

  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
  const MAX_PACK_BYTES = 2 * 1024 * 1024;
  const MAX_IMAGE_EDGE = 1280;
  const OUTPUT_QUALITY = 0.82;
  const focusableSelector = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let pendingImage = '';
  let importedPackLoaded = false;
  let previewStatusOverride = '';
  let returnFocus = null;
  let toastTimer = null;

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2800);
  }

  function setColor(value) {
    const color = /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : '#64d6ea';
    els.color.value = color;
    els.previewImage.style.borderColor = color;
    els.swatches.querySelectorAll('[data-character-color]').forEach(button => {
      button.setAttribute('aria-pressed', button.dataset.characterColor.toLowerCase() === color ? 'true' : 'false');
    });
  }

  function setPackStatus(message = '', kind = 'ready') {
    els.packStatus.textContent = message;
    els.packStatus.dataset.kind = kind;
    els.packStatus.hidden = !message;
  }

  function markPackEdited() {
    if (!importedPackLoaded) return;
    previewStatusOverride = '팩 편집 중 · 적용 전';
    setPackStatus('가져온 팩을 편집 중입니다. ‘설정 저장’을 눌러야 적용됩니다.');
  }

  function renderPreview() {
    const name = els.name.value.trim() || character.name;
    const image = pendingImage || theme.assetUrl(character.avatar);
    els.previewName.textContent = name;
    els.previewImage.src = image;
    els.previewImage.alt = name;
    els.previewStatus.textContent = previewStatusOverride || (pendingImage ? '사용자 이미지' : '기본 이미지');
    els.imageRemove.disabled = !pendingImage;
    setColor(els.color.value);
  }

  function populate() {
    const customization = theme.getCustomization();
    pendingImage = customization && customization.image ? customization.image : '';
    importedPackLoaded = false;
    previewStatusOverride = '';
    setPackStatus();
    els.name.value = customization && customization.name ? customization.name : character.name;
    setColor(customization && customization.accent ? customization.accent : '#64d6ea');
    renderPreview();
  }

  function openModal() {
    returnFocus = document.activeElement;
    populate();
    els.modal.hidden = false;
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('character-settings-open');
    requestAnimationFrame(() => els.name.focus());
  }

  function closeModal() {
    if (els.modal.hidden) return;
    els.modal.hidden = true;
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('character-settings-open');
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    returnFocus = null;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('선택한 이미지를 읽을 수 없습니다.'));
      };
      image.src = url;
    });
  }

  function renderCompressed(image, maxEdge, quality) {
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('이미지 처리 기능을 사용할 수 없습니다.');
    context.fillStyle = '#152338';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  async function compressImage(file) {
    if (!file || !/^image\/(?:jpeg|png|webp|heic|heif)$/i.test(file.type || '')) {
      throw new Error('JPG, PNG, WebP 또는 HEIC 이미지를 선택해 주세요.');
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('이미지는 8MB 이하만 사용할 수 있습니다.');
    const image = await loadImage(file);
    let output = renderCompressed(image, MAX_IMAGE_EDGE, OUTPUT_QUALITY);
    if (output.length > theme.MAX_STORED_IMAGE_LENGTH) output = renderCompressed(image, 960, 0.74);
    if (output.length > theme.MAX_STORED_IMAGE_LENGTH) throw new Error('이미지를 더 작은 파일로 선택해 주세요.');
    return output;
  }

  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('팩 파일을 읽을 수 없습니다.'));
      reader.readAsText(file);
    });
  }

  function packFilename(name) {
    const safeName = String(name || 'character')
      .normalize('NFKC')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 36) || 'character';
    return `momorun-${safeName}.momorun.json`;
  }

  async function deliverPack(text, filename) {
    const blob = new Blob([text], { type: 'application/json' });
    if (typeof File === 'function'
      && typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function') {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: '모모런 캐릭터 팩',
          });
          return 'shared';
        } catch (error) {
          if (error && error.name === 'AbortError') return 'cancelled';
        }
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }

  els.open.addEventListener('click', openModal);
  els.close.addEventListener('click', closeModal);
  els.modal.addEventListener('click', event => {
    if (event.target === els.modal) closeModal();
  });
  els.name.addEventListener('input', () => {
    markPackEdited();
    renderPreview();
  });
  els.color.addEventListener('input', event => {
    markPackEdited();
    setColor(event.target.value);
  });
  els.swatches.addEventListener('click', event => {
    const button = event.target.closest('[data-character-color]');
    if (button) {
      markPackEdited();
      setColor(button.dataset.characterColor);
    }
  });
  els.imageChoose.addEventListener('click', () => els.imageInput.click());
  els.imageRemove.addEventListener('click', () => {
    pendingImage = '';
    els.imageInput.value = '';
    markPackEdited();
    renderPreview();
  });
  els.imageInput.addEventListener('change', async () => {
    const file = els.imageInput.files && els.imageInput.files[0];
    if (!file) return;
    els.imageChoose.disabled = true;
    els.imageChoose.setAttribute('aria-busy', 'true');
    try {
      pendingImage = await compressImage(file);
      markPackEdited();
      renderPreview();
      showToast('대표 이미지를 준비했습니다.');
    } catch (error) {
      els.imageInput.value = '';
      showToast(error && error.message ? error.message : '이미지를 처리하지 못했습니다.');
    } finally {
      els.imageChoose.disabled = false;
      els.imageChoose.removeAttribute('aria-busy');
    }
  });
  els.packExport.addEventListener('click', async () => {
    const text = theme.serializeCharacterPack({
      name: els.name.value.trim() || character.name,
      accent: els.color.value,
      image: pendingImage,
    });
    if (!text) {
      setPackStatus('내보낼 이름과 색상 정보를 확인해 주세요.', 'error');
      return;
    }
    els.packExport.disabled = true;
    els.packExport.setAttribute('aria-busy', 'true');
    try {
      const result = await deliverPack(text, packFilename(els.name.value));
      if (result === 'cancelled') {
        setPackStatus('팩 내보내기를 취소했습니다.');
      } else {
        setPackStatus(pendingImage
          ? '대표 이미지가 포함된 시각 팩을 내보냈습니다. 공유 권한을 확인해 주세요.'
          : '이름과 색상만 담은 시각 팩을 내보냈습니다.');
        showToast(result === 'shared' ? '공유할 캐릭터 팩을 준비했습니다.' : '캐릭터 팩을 저장했습니다.');
      }
    } catch (_) {
      setPackStatus('캐릭터 팩을 내보내지 못했습니다.', 'error');
    } finally {
      els.packExport.disabled = false;
      els.packExport.removeAttribute('aria-busy');
    }
  });
  els.packImport.addEventListener('click', () => els.packInput.click());
  els.packInput.addEventListener('change', async () => {
    const file = els.packInput.files && els.packInput.files[0];
    if (!file) return;
    els.packImport.disabled = true;
    els.packImport.setAttribute('aria-busy', 'true');
    try {
      if (file.size > MAX_PACK_BYTES) throw new Error('캐릭터 팩은 2MB 이하만 가져올 수 있습니다.');
      if (!/\.json$/i.test(file.name || '') && !/(?:^|\/)json$/i.test(file.type || '')) {
        throw new Error('JSON 형식의 캐릭터 팩을 선택해 주세요.');
      }
      const text = await readTextFile(file);
      const parsed = theme.parseCharacterPack(text);
      if (!parsed.ok) throw new Error(parsed.message);

      pendingImage = parsed.customization.image || '';
      els.name.value = parsed.customization.name;
      setColor(parsed.customization.accent);
      importedPackLoaded = true;
      previewStatusOverride = '가져온 팩 · 적용 전';
      renderPreview();
      setPackStatus(`‘${parsed.customization.name}’ 팩을 미리보는 중입니다. ‘설정 저장’을 눌러 적용하세요.`);
      showToast('캐릭터 팩을 안전하게 불러왔습니다.');
      requestAnimationFrame(() => els.save.focus());
    } catch (error) {
      setPackStatus(error && error.message ? error.message : '캐릭터 팩을 가져오지 못했습니다.', 'error');
      showToast('팩 파일을 확인해 주세요.');
    } finally {
      els.packInput.value = '';
      els.packImport.disabled = false;
      els.packImport.removeAttribute('aria-busy');
    }
  });
  els.form.addEventListener('submit', event => {
    event.preventDefault();
    const saved = theme.saveCustomization({
      name: els.name.value,
      accent: els.color.value,
      image: pendingImage,
    });
    if (!saved) {
      showToast('설정을 저장할 공간이 부족합니다.');
      return;
    }
    importedPackLoaded = false;
    previewStatusOverride = '';
    theme.apply();
    closeModal();
    showToast('캐릭터 설정을 저장했습니다.');
  });
  els.reset.addEventListener('click', () => {
    theme.resetCustomization();
    pendingImage = '';
    importedPackLoaded = false;
    previewStatusOverride = '';
    theme.apply();
    populate();
    showToast(`${character.shortName || character.name} 기본 설정으로 돌아왔습니다.`);
  });
  document.addEventListener('keydown', event => {
    if (els.modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(els.dialog.querySelectorAll(focusableSelector))
      .filter(element => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  populate();
})();
