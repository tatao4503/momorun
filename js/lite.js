(() => {
  const $ = id => document.getElementById(id);
  const C = window.NoaCore;
  const storage = C.storage;
  const CIRC = C.CIRC;

  const state = {
    steps: 0,
    goal: 10000,
    running: false,
    currentDateKey: null,
    sources: { sensor: 0, health: 0, test: 0, dev: 0 },
    lastSource: ''
  };

  // 공통 저장/날짜 헬퍼는 core.js(NoaCore)에서 가져온다.
  const { dateKey, legacyDateKey, todayKey, parseRecord } = C;
  const emptySources = () => ({ sensor: 0, health: 0, test: 0, dev: 0 });
  function normalizeSources(sources) {
    return {
      sensor: Math.max(0, +(sources && sources.sensor) || 0),
      health: Math.max(0, +(sources && sources.health) || 0),
      test: Math.max(0, +(sources && sources.test) || 0),
      dev: Math.max(0, +(sources && sources.dev) || 0),
    };
  }

  // DOM Caching
  const els = {
    steps: $('steps'),
    prog: $('prog'),
    goaltxt: $('goaltxt'),
    toggle: $('toggle'),
    sample: $('sample'),
    dot: $('dot'),
    sensorTxt: $('sensorTxt'),
    memo: $('liteMemo'),
    weekTotal: $('liteWeekTotal'),
    weekBars: $('liteWeekBars'),
    toast: $('toast')
  };

  // LocalStorage I/O Debouncing
  let saveTimer = null;
  let storageWarned = false;
  function saveNow() {
    clearTimeout(saveTimer);
    const ok = C.safeSet(todayKey(), JSON.stringify({
      steps: state.steps,
      goal: state.goal,
      sources: normalizeSources(state.sources),
      lastSource: state.lastSource,
      updatedAt: new Date().toISOString(),
    }));
    if (!ok && !storageWarned) {
      storageWarned = true;
      showToast('기록 저장 실패 — 사생활 모드인지 확인해 주세요.');
    } else if (ok) {
      storageWarned = false;
    }
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 2000);
  }
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });

  function load() {
    state.currentDateKey = todayKey();
    const saved = parseRecord(todayKey()) || parseRecord(legacyDateKey(new Date()));
    state.steps = saved ? Math.max(0, +saved.steps || 0) : 0;
    state.goal = saved ? Math.max(100, +saved.goal || 10000) : +(storage.getItem('noa-manbogi-goal') || 10000);
    state.sources = saved ? normalizeSources(saved.sources) : emptySources();
    state.lastSource = saved && saved.lastSource ? saved.lastSource : '';
    if (state.steps > 0 && Object.values(state.sources).every(v => v === 0)) {
      state.sources.sensor = state.steps;
      state.lastSource = 'sensor';
    }
    applyPurchasedItems();
    render();
  }

  function recordFor(date) {
    return parseRecord(dateKey(date)) || parseRecord(legacyDateKey(date)) || { steps: 0, goal: state.goal, sources: emptySources() };
  }

  function recentRecords() {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - i));
      const saved = dateKey(date) === todayKey()
        ? { steps: state.steps, goal: state.goal, sources: state.sources }
        : recordFor(date);
      return { date, ...saved };
    });
  }

  function weekday(date) {
    return date.toLocaleDateString('ko-KR', { weekday: 'short' });
  }

  function formatSteps(n) {
    return `${Math.max(0, Math.round(+n || 0)).toLocaleString()}보`;
  }

  function memoText(ratio, remain) {
    if (ratio >= 1) return '오늘 목표 달성. 기록은 조용히 정리해둘게요.';
    if (state.steps > 0 && remain <= 1500) return '마감까지 조금 남았습니다. 짧은 산책이면 충분해요.';
    if (state.steps > 0) return '오늘 기록이 남았습니다. 무리하지 않고 이어가면 됩니다.';
    return '기록 시작을 누르면 오늘 걸음을 조용히 정리합니다.';
  }

  function renderWeek(records) {
    if (!els.weekTotal || !els.weekBars) return;
    const total = records.reduce((sum, r) => sum + r.steps, 0);
    els.weekTotal.textContent = formatSteps(total);
    els.weekBars.textContent = '';
    records.forEach(record => {
      const ratio = Math.min(record.steps / Math.max(record.goal, 100), 1);
      const row = document.createElement('div');
      row.className = 'lite-week-row';
      const day = document.createElement('span');
      day.textContent = weekday(record.date);
      const track = document.createElement('div');
      track.className = 'lite-week-track';
      const fill = document.createElement('div');
      fill.className = 'lite-week-fill';
      fill.style.width = `${Math.round(ratio * 100)}%`;
      const steps = document.createElement('b');
      steps.textContent = formatSteps(record.steps);
      track.appendChild(fill);
      row.appendChild(day);
      row.appendChild(track);
      row.appendChild(steps);
      els.weekBars.appendChild(row);
    });
  }

  function render() {
    els.steps.textContent = state.steps.toLocaleString();
    const ratio = Math.min(state.steps / state.goal, 1);
    els.prog.style.strokeDashoffset = CIRC * (1 - ratio);
    const remain = Math.max(state.goal - state.steps, 0);
    els.goaltxt.textContent = remain > 0 
      ? `목표까지 ${remain.toLocaleString()}보 남음` 
      : `목표 달성 완료!`;
    if (els.memo) els.memo.textContent = memoText(ratio, remain);
    renderWeek(recentRecords());
  }

  function addSteps(n, source = 'sensor') {
    const nowKey = todayKey();
    if (state.currentDateKey && state.currentDateKey !== nowKey) {
      state.currentDateKey = nowKey;
      state.steps = 0;
      state.sources = emptySources();
      state.lastSource = '';
    }
    const add = Math.max(0, Math.round(+n || 0));
    if (add <= 0) return;
    state.steps += add;
    const safeSource = state.sources[source] === undefined ? 'sensor' : source;
    state.sources[safeSource] += add;
    state.lastSource = safeSource;
    render();
    save();
  }

  // --- Step Detection (공유 코어 감지기) ---
  const stepDetector = C.createStepDetector(() => { addSteps(1, 'sensor'); pulse(); });
  const onMotion = e => stepDetector.handle(e);

  let pulseT;
  function pulse() {
    els.steps.style.transform = 'scale(1.06)';
    clearTimeout(pulseT);
    pulseT = setTimeout(() => els.steps.style.transform = 'scale(1)', 120);
    if (navigator.vibrate) navigator.vibrate([10]);
  }

  function setSensor(on, txt) {
    els.dot.classList.toggle('on', on);
    els.sensorTxt.textContent = txt;
  }

  async function start() {
    // iOS 13+ permission
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') { setSensor(false, '권한 거부됨'); return; }
      } catch (err) { setSensor(false, '권한 요청 실패'); return; }
    }
    if (typeof DeviceMotionEvent === 'undefined') {
      setSensor(false, '센서 미지원 · 샘플 기록 사용 가능');
      showToast('이 브라우저는 센서를 지원하지 않아요. 샘플 기록으로 화면을 확인할 수 있습니다.');
      return;
    }
    window.addEventListener('devicemotion', onMotion);
    state.running = true;
    setSensor(true, '측정 중');
    els.toggle.textContent = '정지';
    els.toggle.classList.add('stop');
    showToast("모모톡: 기록을 시작합니다.");
  }

  function stop() {
    window.removeEventListener('devicemotion', onMotion);
    state.running = false;
    setSensor(false, '정지됨');
    els.toggle.textContent = '시작';
    els.toggle.classList.remove('stop');
  }

  els.toggle.onclick = () => {
    if (navigator.vibrate) navigator.vibrate([15]);
    state.running ? stop() : start();
  };

  if (els.sample) {
    els.sample.onclick = () => {
      addSteps(500, 'test');
      pulse();
      showToast('샘플 기록 500보를 추가했습니다.');
    };
  }

  // --- Background Theme (Sync with Full Version) ---
  function applyPurchasedItems() {
    const equipped = storage.getItem('noa-equipped-theme');
    if (equipped) {
      document.body.classList.add(equipped.replace('_', '-'));
    }
  }

  // --- Lite Toast ---
  let toastTimer;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
    }, 3000);
  }

  load();
  C.registerServiceWorker();
})();
