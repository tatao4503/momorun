(() => {
  const $ = id => document.getElementById(id);
  const C = window.NoaCore;
  const CHAR = window.MomoCharacter;
  const patrol = CHAR.adventure;
  const checkpoints = patrol.checkpoints;
  const routePoints = [patrol.start, ...checkpoints.map(checkpoint => checkpoint.point)];
  const MEMORY_STORAGE_KEY = 'noa-patrol-memories-v1';

  const els = {
    steps: $('patrolSteps'),
    percent: $('patrolPercent'),
    count: $('patrolCount'),
    map: $('mapStage'),
    marker: $('patrolMarker'),
    layer: $('checkpointLayer'),
    dialogue: $('patrolDialogue'),
    sceneLabel: $('sceneLabel'),
    nextTarget: $('nextTarget'),
    nextFill: $('nextFill'),
    list: $('checkpointList'),
    refresh: $('refreshPatrol'),
    toast: $('patrolToast'),
    memoryArchive: $('memoryArchive'),
    memoryCount: $('memoryCount'),
    memoryList: $('memoryList'),
    memoryModal: $('memoryModal'),
    memoryClose: $('memoryClose'),
    memoryDetail: $('memoryDetail'),
    memoryModalNumber: $('memoryModalNumber'),
    memoryModalLocation: $('memoryModalLocation'),
    memoryModalTitle: $('memoryModalTitle'),
    memoryModalNote: $('memoryModalNote'),
    memoryModalStamp: $('memoryModalStamp'),
  };

  let state = { steps: 0, goal: 10000, ratio: 0, reached: 0 };
  let selectedCheckpoint = -1;
  let toastTimer = null;
  let memories = {};
  let memoryReturnFocus = null;

  function formatSteps(value) {
    return `${Math.max(0, Math.round(+value || 0)).toLocaleString()}보`;
  }

  function recordToday() {
    return C.parseRecord(C.todayKey())
      || C.parseRecord(C.legacyDateKey(new Date()))
      || { steps: 0, goal: C.fallbackGoal() };
  }

  function readMemories() {
    try {
      const parsed = JSON.parse(C.storage.getItem(MEMORY_STORAGE_KEY) || '{}');
      const cards = parsed && parsed.cards && typeof parsed.cards === 'object' ? parsed.cards : {};
      return checkpoints.reduce((valid, checkpoint) => {
        const card = cards[checkpoint.id];
        if (!card || typeof card !== 'object') return valid;
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(card.date || '')) ? String(card.date) : '';
        if (!date) return valid;
        valid[checkpoint.id] = {
          date,
          steps: Math.max(0, Math.round(+card.steps || 0)),
          unlockedAt: typeof card.unlockedAt === 'string' ? card.unlockedAt : '',
        };
        return valid;
      }, {});
    } catch (_) {
      return {};
    }
  }

  function saveMemories() {
    return C.safeSet(MEMORY_STORAGE_KEY, JSON.stringify({
      version: 1,
      cards: memories,
    }));
  }

  function unlockReachedMemories() {
    const unlocked = [];
    for (let index = 0; index < state.reached; index += 1) {
      const checkpoint = checkpoints[index];
      if (memories[checkpoint.id]) continue;
      memories[checkpoint.id] = {
        date: C.localDateStamp(),
        steps: state.steps,
        unlockedAt: new Date().toISOString(),
      };
      unlocked.push(checkpoint);
    }
    if (unlocked.length) saveMemories();
    return unlocked;
  }

  function formatMemoryDate(stamp) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(stamp || ''));
    return match ? `${match[1]}.${match[2]}.${match[3]}` : '기록일 미상';
  }

  function markerPosition(ratio) {
    const progress = Math.min(1, Math.max(0, ratio)) * checkpoints.length;
    const segment = Math.min(checkpoints.length - 1, Math.floor(progress));
    const localProgress = progress >= checkpoints.length ? 1 : progress - segment;
    const from = routePoints[segment];
    const to = routePoints[segment + 1];
    return {
      x: from.x + ((to.x - from.x) * localProgress),
      y: from.y + ((to.y - from.y) * localProgress),
    };
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2600);
  }

  function checkpointState(index) {
    if (index < state.reached) return 'reached';
    if (index === state.reached && state.reached < checkpoints.length) return 'current';
    return 'locked';
  }

  function selectCheckpoint(index, announce = true) {
    const checkpoint = checkpoints[index];
    const targetSteps = Math.round(state.goal * checkpoint.p);
    selectedCheckpoint = index;

    if (index < state.reached) {
      els.sceneLabel.textContent = `${String(index + 1).padStart(2, '0')} · ${checkpoint.name}`;
      els.dialogue.textContent = checkpoint.line;
    } else {
      const remaining = Math.max(0, targetSteps - state.steps);
      els.sceneLabel.textContent = `${String(index + 1).padStart(2, '0')} · ${checkpoint.name}`;
      els.dialogue.textContent = `${checkpoint.name}까지 ${formatSteps(remaining)} 남았습니다. 지금 속도로 이어가면 충분해요.`;
    }

    if (announce) showToast(els.dialogue.textContent);
  }

  function defaultBriefing() {
    if (state.reached >= checkpoints.length) {
      els.sceneLabel.textContent = 'PATROL COMPLETE';
      els.dialogue.textContent = patrol.complete;
      return;
    }
    if (state.reached > 0) {
      const checkpoint = checkpoints[state.reached - 1];
      els.sceneLabel.textContent = `${String(state.reached).padStart(2, '0')} · ${checkpoint.name}`;
      els.dialogue.textContent = checkpoint.line;
      return;
    }
    els.sceneLabel.textContent = '순찰 준비';
    els.dialogue.textContent = patrol.opening;
  }

  function renderCheckpoints() {
    els.layer.textContent = '';
    els.list.textContent = '';

    checkpoints.forEach((checkpoint, index) => {
      const status = checkpointState(index);
      const targetSteps = Math.round(state.goal * checkpoint.p);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `checkpoint ${status}`;
      button.style.setProperty('--checkpoint-x', `${checkpoint.point.x}%`);
      button.style.setProperty('--checkpoint-y', `${checkpoint.point.y}%`);
      button.textContent = String(index + 1);
      button.title = checkpoint.name;
      button.setAttribute('aria-label', `${checkpoint.name}, ${status === 'reached' ? '확인 완료' : `${formatSteps(targetSteps)}에 확인`}`);
      button.addEventListener('click', () => selectCheckpoint(index));
      els.layer.appendChild(button);

      const item = document.createElement('li');
      if (status === 'reached') item.className = 'done';
      const order = document.createElement('span');
      order.textContent = status === 'reached' ? `${String(index + 1).padStart(2, '0')} · 완료` : `${String(index + 1).padStart(2, '0')} · ${formatSteps(targetSteps)}`;
      const name = document.createElement('strong');
      name.textContent = checkpoint.name;
      item.appendChild(order);
      item.appendChild(name);
      els.list.appendChild(item);
    });
  }

  function closeMemory() {
    if (els.memoryModal.hidden) return;
    els.memoryModal.hidden = true;
    els.memoryModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('memory-open');
    if (memoryReturnFocus && document.contains(memoryReturnFocus)) memoryReturnFocus.focus();
    memoryReturnFocus = null;
  }

  function openMemory(index) {
    const checkpoint = checkpoints[index];
    const card = memories[checkpoint.id];
    if (!card) {
      const targetSteps = Math.round(state.goal * checkpoint.p);
      showToast(`${checkpoint.name}에 도착하면 추억 카드가 열립니다. ${formatSteps(targetSteps)}가 필요해요.`);
      return;
    }

    memoryReturnFocus = document.activeElement;
    els.memoryDetail.dataset.memoryIndex = String(index);
    els.memoryModalNumber.textContent = `MEMORY ${String(index + 1).padStart(2, '0')}`;
    els.memoryModalLocation.textContent = checkpoint.name;
    els.memoryModalTitle.textContent = checkpoint.memory.title;
    els.memoryModalNote.textContent = checkpoint.memory.note;
    els.memoryModalStamp.textContent = `${formatMemoryDate(card.date)} · ${formatSteps(card.steps)}`;
    els.memoryModal.hidden = false;
    els.memoryModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('memory-open');
    requestAnimationFrame(() => els.memoryClose.focus());
  }

  function renderMemories() {
    const unlockedCount = checkpoints.filter(checkpoint => memories[checkpoint.id]).length;
    els.memoryCount.textContent = `${unlockedCount} / ${checkpoints.length}`;
    els.memoryArchive.dataset.complete = unlockedCount === checkpoints.length ? 'true' : 'false';
    els.memoryList.textContent = '';

    checkpoints.forEach((checkpoint, index) => {
      const card = memories[checkpoint.id];
      const item = document.createElement('li');
      const button = document.createElement('button');
      const visual = document.createElement('span');
      const number = document.createElement('span');
      const marker = document.createElement('span');
      const copy = document.createElement('span');
      const location = document.createElement('span');
      const title = document.createElement('strong');
      const meta = document.createElement('span');

      button.type = 'button';
      button.className = `memory-card ${card ? 'unlocked' : 'locked'}`;
      button.dataset.memoryIndex = String(index);
      button.setAttribute('aria-label', card
        ? `${checkpoint.name} 추억 카드, 보관 완료`
        : `${checkpoint.name} 추억 카드, ${formatSteps(Math.round(state.goal * checkpoint.p))}에 해금`);

      visual.className = 'memory-card-visual';
      number.className = 'memory-card-number';
      number.textContent = `MEMORY ${String(index + 1).padStart(2, '0')}`;
      marker.className = 'memory-card-marker';
      marker.textContent = card ? String(index + 1) : '?';
      visual.appendChild(number);
      visual.appendChild(marker);

      if (card) {
        const portrait = document.createElement('img');
        portrait.src = 'icon-192.png';
        portrait.alt = '';
        visual.appendChild(portrait);
      }

      copy.className = 'memory-card-copy';
      location.className = 'memory-card-location';
      location.textContent = checkpoint.name;
      title.textContent = card ? checkpoint.memory.title : '기록 대기';
      meta.className = 'memory-card-meta';
      meta.textContent = card
        ? `${formatMemoryDate(card.date)} · ${formatSteps(card.steps)}`
        : `${formatSteps(Math.round(state.goal * checkpoint.p))}에 보관`;
      copy.appendChild(location);
      copy.appendChild(title);
      copy.appendChild(meta);

      button.appendChild(visual);
      button.appendChild(copy);
      button.addEventListener('click', () => openMemory(index));
      item.appendChild(button);
      els.memoryList.appendChild(item);
    });
  }

  function renderNextProgress() {
    if (state.reached >= checkpoints.length) {
      els.nextTarget.textContent = '오늘 순찰 완료';
      els.nextFill.style.width = '100%';
      return;
    }

    const previousP = state.reached === 0 ? 0 : checkpoints[state.reached - 1].p;
    const next = checkpoints[state.reached];
    const interval = Math.max(0.01, next.p - previousP);
    const segmentRatio = Math.min(1, Math.max(0, (state.ratio - previousP) / interval));
    const remaining = Math.max(0, Math.round((state.goal * next.p) - state.steps));
    els.nextTarget.textContent = `${next.name}까지 ${formatSteps(remaining)}`;
    els.nextFill.style.width = `${Math.round(segmentRatio * 100)}%`;
  }

  function render() {
    const point = markerPosition(state.ratio);
    els.steps.textContent = formatSteps(state.steps);
    els.percent.textContent = `${Math.round(state.ratio * 100)}%`;
    els.count.textContent = `${state.reached} / ${checkpoints.length}`;
    els.marker.style.setProperty('--marker-x', `${point.x}%`);
    els.marker.style.setProperty('--marker-y', `${point.y}%`);
    els.map.dataset.scene = String(state.reached);
    renderCheckpoints();
    renderNextProgress();
    renderMemories();

    if (selectedCheckpoint >= 0) selectCheckpoint(selectedCheckpoint, false);
    else defaultBriefing();
  }

  function loadRecord({ announce = false } = {}) {
    const record = recordToday();
    state.steps = Math.max(0, +record.steps || 0);
    state.goal = Math.max(100, +record.goal || C.fallbackGoal());
    state.ratio = Math.min(1, state.steps / state.goal);
    state.reached = checkpoints.filter(checkpoint => state.ratio >= checkpoint.p).length;
    memories = readMemories();
    const newlyUnlocked = unlockReachedMemories();
    selectedCheckpoint = -1;
    render();
    if (newlyUnlocked.length === 1) {
      showToast(`${newlyUnlocked[0].name} 추억 카드가 보관됐습니다.`);
    } else if (newlyUnlocked.length > 1) {
      showToast(`새 순찰 추억 카드 ${newlyUnlocked.length}장이 보관됐습니다.`);
    } else if (announce) {
      showToast(`오늘 ${formatSteps(state.steps)} 기록을 불러왔습니다.`);
    }
  }

  els.refresh.addEventListener('click', () => loadRecord({ announce: true }));
  els.memoryClose.addEventListener('click', closeMemory);
  els.memoryModal.addEventListener('click', event => {
    if (event.target === els.memoryModal) closeMemory();
  });
  document.addEventListener('keydown', event => {
    if (els.memoryModal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMemory();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      els.memoryClose.focus();
    }
  });
  window.addEventListener('focus', () => loadRecord());
  window.addEventListener('storage', event => {
    if (event.key === C.todayKey() || event.key === 'noa-manbogi-goal' || event.key === MEMORY_STORAGE_KEY) loadRecord();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadRecord();
  });

  C.setupAppLifecycle(() => loadRecord());
  loadRecord();
  C.registerServiceWorker();
})();
