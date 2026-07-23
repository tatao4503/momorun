(() => {
  const $ = id => document.getElementById(id);
  const C = window.NoaCore;
  const storage = C.storage;
  const CIRC = C.CIRC;
  const HEALTH_KEY = 'noa-health-sync-enabled';
  const NOTIFICATION_KEY = 'noa-notifications-enabled';
  const TTS_KEY = 'noa-manbogi-voice';
  const LAST_SYNC_KEY = 'momorun-life-last-sync-at';

  const state = {
    steps: 0,
    goal: 10000,
    currentDateKey: '',
    sources: emptySources(),
    lastSource: '',
    healthEnabled: storage.getItem(HEALTH_KEY) === '1',
    notificationsEnabled: storage.getItem(NOTIFICATION_KEY) === '1',
    ttsEnabled: storage.getItem(TTS_KEY) === '1',
    motionRunning: false,
    syncing: false,
  };

  const els = {
    date: $('todayDate'),
    greeting: $('heroGreeting'),
    recordStatus: $('recordStatus'),
    steps: $('lifeSteps'),
    progress: $('lifeProgress'),
    percent: $('goalPercent'),
    goalRemain: $('goalRemain'),
    memo: $('lifeMemo'),
    remain: $('remainingSteps'),
    lastSync: $('lastSync'),
    quickSync: $('quickSync'),
    sync: $('syncHealth'),
    syncLabel: $('syncHealthLabel'),
    healthStatus: $('healthStatus'),
    speakMemo: $('speakMemo'),
    weekTotal: $('weekTotal'),
    weekAverage: $('weekAverage'),
    weekGoals: $('weekGoals'),
    weekRecords: $('weekRecords'),
    goalInput: $('goalInput'),
    saveGoal: $('saveGoal'),
    notificationToggle: $('notificationToggle'),
    ttsToggle: $('ttsToggle'),
    motionToggle: $('motionToggle'),
    toast: $('lifeToast'),
  };

  function emptySources() {
    return { sensor: 0, health: 0, test: 0, dev: 0 };
  }

  function normalizeSources(sources) {
    return {
      sensor: Math.max(0, +(sources && sources.sensor) || 0),
      health: Math.max(0, +(sources && sources.health) || 0),
      test: Math.max(0, +(sources && sources.test) || 0),
      dev: Math.max(0, +(sources && sources.dev) || 0),
    };
  }

  function formatSteps(value) {
    return `${Math.max(0, Math.round(+value || 0)).toLocaleString('ko-KR')}보`;
  }

  function load() {
    state.currentDateKey = C.todayKey();
    const saved = C.parseRecord(C.todayKey()) || C.parseRecord(C.legacyDateKey(new Date()));
    state.goal = saved
      ? Math.max(100, +saved.goal || 10000)
      : Math.max(100, +(storage.getItem('noa-manbogi-goal') || 10000) || 10000);
    state.steps = saved ? Math.max(0, +saved.steps || 0) : 0;
    state.sources = saved ? normalizeSources(saved.sources) : emptySources();
    state.lastSource = saved && saved.lastSource ? saved.lastSource : '';
    if (state.steps > 0 && Object.values(state.sources).every(value => value === 0)) {
      state.sources.sensor = state.steps;
      state.lastSource = 'sensor';
    }
    els.goalInput.value = String(state.goal);
    render();
  }

  let saveTimer = null;
  let storageWarned = false;
  function saveNow() {
    clearTimeout(saveTimer);
    const ok = C.safeSet(C.todayKey(), JSON.stringify({
      steps: state.steps,
      goal: state.goal,
      sources: normalizeSources(state.sources),
      lastSource: state.lastSource,
      updatedAt: new Date().toISOString(),
    }));
    if (!ok && !storageWarned) {
      storageWarned = true;
      showToast('기록을 영구 저장하지 못했습니다. 저장 공간 설정을 확인해 주세요.');
    } else if (ok) {
      storageWarned = false;
    }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
  }

  function ensureToday() {
    const key = C.todayKey();
    if (state.currentDateKey === key) return;
    saveNow();
    state.currentDateKey = key;
    const saved = C.parseRecord(key) || C.parseRecord(C.legacyDateKey(new Date()));
    state.steps = saved ? saved.steps : 0;
    state.sources = saved ? normalizeSources(saved.sources) : emptySources();
    state.lastSource = saved ? saved.lastSource : '';
  }

  function recordFor(date) {
    return C.parseRecord(C.dateKey(date)) || C.parseRecord(C.legacyDateKey(date)) || {
      steps: 0,
      goal: state.goal,
      sources: emptySources(),
    };
  }

  function recentRecords() {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const record = C.dateKey(date) === C.todayKey()
        ? { steps: state.steps, goal: state.goal, sources: state.sources }
        : recordFor(date);
      return { date, ...record };
    });
  }

  function memoText() {
    const ratio = state.steps / Math.max(100, state.goal);
    const remain = Math.max(0, state.goal - state.steps);
    if (ratio >= 1) return '오늘 목표를 달성했습니다. 기록은 정확하게 정리해 둘게요.';
    if (state.steps > 0 && remain <= 1500) return '마감까지 조금 남았습니다. 짧은 산책이면 충분해요.';
    if (state.steps >= state.goal * 0.5) return '절반을 넘었습니다. 무리하지 않고 이 흐름을 이어가요.';
    if (state.steps > 0) return '오늘 기록이 차곡차곡 쌓이고 있어요.';
    return state.healthEnabled
      ? '건강 앱에서 오늘 걸음을 확인해 볼까요?'
      : '건강 앱을 연결하면 오늘 걸음을 자동으로 정리합니다.';
  }

  function greetingText() {
    const hour = new Date().getHours();
    if (hour < 11) return '좋은 아침이에요. 오늘 기록을 시작할까요?';
    if (hour < 18) return '오늘 걸음도 빠짐없이 정리하고 있어요.';
    return '오늘 하루 기록을 함께 확인해 볼까요?';
  }

  function render() {
    ensureToday();
    const ratio = Math.min(state.steps / Math.max(100, state.goal), 1);
    const percent = Math.round(ratio * 100);
    const remain = Math.max(0, state.goal - state.steps);
    els.date.textContent = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    els.greeting.textContent = greetingText();
    els.recordStatus.textContent = ratio >= 1 ? '결재 완료' : state.steps > 0 ? '기록 중' : '기록 준비';
    els.steps.textContent = state.steps.toLocaleString('ko-KR');
    els.progress.style.strokeDashoffset = String(CIRC * (1 - ratio));
    els.percent.textContent = `${percent}%`;
    els.goalRemain.textContent = remain > 0 ? `목표 ${formatSteps(state.goal)}` : '오늘 목표 달성';
    els.memo.textContent = memoText();
    els.remain.textContent = formatSteps(remain);
    els.lastSync.textContent = formatSyncTime(storage.getItem(LAST_SYNC_KEY));
    els.syncLabel.textContent = state.healthEnabled ? '건강 앱 동기화' : '건강 앱 연결';
    els.healthStatus.textContent = healthStatusText();
    els.speakMemo.disabled = !state.ttsEnabled;
    setSwitch(els.notificationToggle, state.notificationsEnabled, '걷기 알림');
    setSwitch(els.ttsToggle, state.ttsEnabled, 'TTS 안내 음성');
    setSwitch(els.motionToggle, state.motionRunning, '동작 센서 보조 측정');
    renderWeek(recentRecords());
  }

  function formatSyncTime(value) {
    if (!value) return '아직 없음';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '아직 없음';
    const today = new Date();
    const sameDay = C.dateKey(date) === C.dateKey(today);
    return sameDay
      ? date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  }

  function healthStatusText() {
    if (!C.isNativePlatform()) return 'HealthKit 연동은 iPhone 앱에서 사용할 수 있습니다.';
    if (state.syncing) return '건강 앱의 오늘 걸음을 확인하고 있습니다.';
    if (state.healthEnabled) return '앱을 다시 열 때 HealthKit 걸음을 자동으로 확인합니다.';
    return 'HealthKit은 선택한 경우에만 걸음 수를 읽습니다.';
  }

  function renderWeek(records) {
    const total = records.reduce((sum, record) => sum + record.steps, 0);
    const completed = records.filter(record => record.steps >= Math.max(100, record.goal)).length;
    els.weekTotal.textContent = formatSteps(total);
    els.weekAverage.textContent = formatSteps(Math.round(total / records.length));
    els.weekGoals.textContent = `${completed}일`;
    els.weekRecords.textContent = '';

    records.forEach((record, index) => {
      const ratio = Math.min(record.steps / Math.max(100, record.goal), 1);
      const row = document.createElement('div');
      row.className = `week-row${ratio >= 1 ? ' goal' : ''}${index === records.length - 1 ? ' today' : ''}`;
      const day = document.createElement('span');
      day.className = 'week-day';
      day.textContent = index === records.length - 1
        ? '오늘'
        : record.date.toLocaleDateString('ko-KR', { weekday: 'short' });
      const track = document.createElement('div');
      track.className = 'week-track';
      const fill = document.createElement('div');
      fill.className = 'week-fill';
      fill.style.width = `${Math.round(ratio * 100)}%`;
      const value = document.createElement('strong');
      value.textContent = formatSteps(record.steps);
      track.appendChild(fill);
      row.append(day, track, value);
      els.weekRecords.appendChild(row);
    });
  }

  function setSwitch(element, enabled, name) {
    element.setAttribute('aria-checked', enabled ? 'true' : 'false');
    element.setAttribute('aria-label', `${name} ${enabled ? '끄기' : '켜기'}`);
  }

  function setSyncing(syncing) {
    state.syncing = syncing;
    els.sync.disabled = syncing;
    els.quickSync.disabled = syncing;
    els.quickSync.classList.toggle('syncing', syncing);
    render();
  }

  async function syncHealth({ requestAuthorization = false, announce = true } = {}) {
    if (state.syncing) return { ok: false, reason: 'busy' };
    if (!requestAuthorization && !state.healthEnabled) return { ok: false, reason: 'disabled' };
    if (!C.getNativePlugin('Health')) {
      if (announce) showToast('HealthKit 연동은 iPhone 앱에서 사용할 수 있습니다.');
      render();
      return { ok: false, reason: 'unavailable' };
    }

    setSyncing(true);
    const before = state.steps;
    const result = await C.syncHealthKit({
      requestAuthorization,
      getSteps: () => state.steps,
      setSteps: value => {
        const next = Math.max(state.steps, Math.round(+value || 0));
        const delta = Math.max(0, next - state.steps);
        state.steps = next;
        state.sources.health += delta;
        if (delta > 0) state.lastSource = 'health';
      },
    });

    if (result && result.ok) {
      state.healthEnabled = true;
      storage.setItem(HEALTH_KEY, '1');
      storage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      saveNow();
      if (announce) {
        const added = state.steps - before;
        showToast(added > 0 ? `${formatSteps(added)}를 새로 반영했습니다.` : '오늘 걸음이 최신 상태입니다.');
      }
    } else if (result && result.reason === 'permission-denied') {
      state.healthEnabled = false;
      storage.removeItem(HEALTH_KEY);
      if (announce) showToast('건강 앱의 걸음 읽기 권한이 필요합니다.');
    } else if (announce) {
      showToast('건강 앱 동기화를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    setSyncing(false);
    if (result && result.ok) C.initBackgroundTasks(() => syncHealth({ announce: false }));
    return result;
  }

  async function setNotifications(enabled) {
    const plugin = C.getNativePlugin('LocalNotifications');
    if (!plugin) {
      showToast('걷기 알림은 iPhone 앱에서 사용할 수 있습니다.');
      return;
    }
    els.notificationToggle.disabled = true;
    try {
      if (!enabled) {
        await plugin.cancel({ notifications: [{ id: 1 }, { id: 2 }] });
        state.notificationsEnabled = false;
        storage.removeItem(NOTIFICATION_KEY);
        showToast('걷기 알림을 껐습니다.');
      } else {
        const permission = await plugin.requestPermissions();
        if (!permission || permission.display !== 'granted') {
          state.notificationsEnabled = false;
          storage.removeItem(NOTIFICATION_KEY);
          showToast('알림 권한이 필요합니다.');
          return;
        }
        await plugin.cancel({ notifications: [{ id: 1 }, { id: 2 }] });
        await plugin.schedule({
          notifications: [
            {
              id: 1,
              title: '모모런',
              body: '좋은 아침이에요. 오늘 기록을 시작할까요?',
              schedule: { on: { hour: 8, minute: 0 } },
            },
            {
              id: 2,
              title: '모모런',
              body: '오늘 하루도 수고 많으셨어요. 기록을 확인해 볼까요?',
              schedule: { on: { hour: 20, minute: 0 } },
            },
          ],
        });
        state.notificationsEnabled = true;
        storage.setItem(NOTIFICATION_KEY, '1');
        showToast('오전 8시와 오후 8시에 알려드릴게요.');
      }
    } catch (error) {
      console.error('알림 설정 실패:', error);
      state.notificationsEnabled = false;
      storage.removeItem(NOTIFICATION_KEY);
      showToast('알림 설정을 완료하지 못했습니다.');
    } finally {
      els.notificationToggle.disabled = false;
      render();
    }
  }

  function speak(text) {
    if (!state.ttsEnabled || !text || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(voice => voice.lang.includes('ko-KR')) || null;
    utterance.rate = 1;
    utterance.pitch = 1.02;
    speechSynthesis.speak(utterance);
  }

  const stepDetector = C.createStepDetector(() => {
    ensureToday();
    state.steps += 1;
    state.sources.sensor += 1;
    state.lastSource = 'sensor';
    render();
    save();
  });
  const onMotion = event => stepDetector.handle(event);

  async function setMotion(enabled) {
    if (!enabled) {
      window.removeEventListener('devicemotion', onMotion);
      state.motionRunning = false;
      stepDetector.reset();
      render();
      showToast('보조 측정을 정지했습니다.');
      return;
    }
    if (typeof DeviceMotionEvent === 'undefined') {
      showToast('이 기기에서는 동작 센서를 사용할 수 없습니다.');
      return;
    }
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          showToast('동작 센서 권한이 필요합니다.');
          return;
        }
      } catch (error) {
        console.warn('동작 센서 권한 요청 실패:', error);
        showToast('동작 센서 권한을 확인하지 못했습니다.');
        return;
      }
    }
    window.addEventListener('devicemotion', onMotion);
    state.motionRunning = true;
    render();
    showToast('화면을 켠 동안 보조 측정을 시작합니다.');
  }

  let toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2800);
  }

  function selectTab(name) {
    document.querySelectorAll('[data-panel]').forEach(panel => {
      const selected = panel.dataset.panel === name;
      panel.hidden = !selected;
      panel.classList.toggle('active', selected);
    });
    document.querySelectorAll('[data-tab]').forEach(button => {
      const selected = button.dataset.tab === name;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
  });
  els.quickSync.addEventListener('click', () => syncHealth({ requestAuthorization: !state.healthEnabled }));
  els.sync.addEventListener('click', () => syncHealth({ requestAuthorization: !state.healthEnabled }));
  els.speakMemo.addEventListener('click', () => speak(els.memo.textContent));
  els.notificationToggle.addEventListener('click', () => setNotifications(!state.notificationsEnabled));
  els.ttsToggle.addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    storage.setItem(TTS_KEY, state.ttsEnabled ? '1' : '0');
    render();
    showToast(state.ttsEnabled ? '기기 내장 TTS 안내를 켰습니다.' : 'TTS 안내를 껐습니다.');
    if (state.ttsEnabled) speak('TTS 안내 음성을 켰습니다.');
  });
  els.motionToggle.addEventListener('click', () => setMotion(!state.motionRunning));
  els.saveGoal.addEventListener('click', () => {
    const nextGoal = Math.min(100000, Math.max(100, Math.round((+els.goalInput.value || 10000) / 100) * 100));
    state.goal = nextGoal;
    els.goalInput.value = String(nextGoal);
    storage.setItem('noa-manbogi-goal', String(nextGoal));
    saveNow();
    render();
    showToast(`하루 목표를 ${formatSteps(nextGoal)}로 저장했습니다.`);
  });

  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });

  load();
  C.setupAppLifecycle(() => syncHealth({ announce: false }));
  if (state.healthEnabled) {
    syncHealth({ announce: false });
  }
  C.registerServiceWorker();
})();
