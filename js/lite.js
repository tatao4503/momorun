(() => {
  const $ = id => document.getElementById(id);
  const C = window.NoaCore;
  const CIRC = C.CIRC;

  const state = {
    steps: 0,
    goal: 10000,
    running: false,
    currentDateKey: null,
    sources: { sensor: 0, health: 0, test: 0, dev: 0 }
  };

  // 공통 저장/날짜 헬퍼는 core.js(NoaCore)에서 가져온다.
  const { legacyDateKey, todayKey, parseRecord } = C;
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
    dot: $('dot'),
    sensorTxt: $('sensorTxt'),
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
      lastSource: state.steps > 0 ? 'sensor' : '',
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
  window.addEventListener('beforeunload', saveNow);

  function load() {
    state.currentDateKey = todayKey();
    const saved = parseRecord(todayKey()) || parseRecord(legacyDateKey(new Date()));
    state.steps = saved ? Math.max(0, +saved.steps || 0) : 0;
    state.goal = saved ? Math.max(100, +saved.goal || 10000) : +(localStorage.getItem('noa-manbogi-goal') || 10000);
    state.sources = saved ? normalizeSources(saved.sources) : emptySources();
    if (state.steps > 0 && Object.values(state.sources).every(v => v === 0)) {
      state.sources.sensor = state.steps;
    }
    applyPurchasedItems();
    render();
  }

  function render() {
    els.steps.textContent = state.steps.toLocaleString();
    const ratio = Math.min(state.steps / state.goal, 1);
    els.prog.style.strokeDashoffset = CIRC * (1 - ratio);
    const remain = Math.max(state.goal - state.steps, 0);
    els.goaltxt.textContent = remain > 0 
      ? `목표까지 ${remain.toLocaleString()}보 남음` 
      : `목표 달성 완료!`;
  }

  function addSteps(n) {
    const nowKey = todayKey();
    if (state.currentDateKey && state.currentDateKey !== nowKey) {
      state.currentDateKey = nowKey;
      state.steps = 0;
      state.sources = emptySources();
    }
    const add = Math.max(0, Math.round(+n || 0));
    state.steps += add;
    state.sources.sensor += add;
    render();
    save();
  }

  // --- Step Detection (공유 코어 감지기) ---
  const stepDetector = C.createStepDetector(() => { addSteps(1); pulse(); });
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
      setSensor(false, '센서 미지원');
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

  // --- Background Theme (Sync with Full Version) ---
  function applyPurchasedItems() {
    const equipped = localStorage.getItem('noa-equipped-theme');
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
})();
