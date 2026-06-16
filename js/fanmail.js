(() => {
  const $ = id => document.getElementById(id);
  const C = window.NoaCore;
  const CIRC = C.CIRC;
  const STORAGE_PREFIX = 'noa-fanmail-';
  const GOAL = 8000;

  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => dateKey(new Date());

  const state = {
    steps: 0,
    goal: GOAL,
    running: false,
    currentDateKey: todayKey(),
    sources: { motion: 0, sample: 0 },
  };

  const els = {
    steps: $('steps'),
    progress: $('progress'),
    goalText: $('goalText'),
    toggle: $('toggle'),
    sample: $('sample'),
    sensorDot: $('sensorDot'),
    sensorText: $('sensorText'),
    todayBrief: $('todayBrief'),
    sourceNote: $('sourceNote'),
    noaMemo: $('noaMemo'),
    weekTotal: $('weekTotal'),
    weekStamps: $('weekStamps'),
    weekBars: $('weekBars'),
    toast: $('toast'),
  };

  function normalizeSources(sources) {
    return {
      motion: Math.max(0, +(sources && sources.motion) || 0),
      sample: Math.max(0, +(sources && sources.sample) || 0),
    };
  }

  function readRecord(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return {
        steps: Math.max(0, +record.steps || 0),
        goal: Math.max(100, +record.goal || GOAL),
        sources: normalizeSources(record.sources),
      };
    } catch (_) {
      return null;
    }
  }

  function writeRecord() {
    localStorage.setItem(todayKey(), JSON.stringify({
      steps: state.steps,
      goal: state.goal,
      sources: normalizeSources(state.sources),
      updatedAt: new Date().toISOString(),
    }));
  }

  function load() {
    state.currentDateKey = todayKey();
    const saved = readRecord(todayKey());
    state.steps = saved ? saved.steps : 0;
    state.goal = saved ? saved.goal : GOAL;
    state.sources = saved ? normalizeSources(saved.sources) : { motion: 0, sample: 0 };
    render();
  }

  function recentRecords() {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - i));
      const key = dateKey(date);
      const saved = key === todayKey()
        ? { steps: state.steps, goal: state.goal, sources: state.sources }
        : readRecord(key);
      return {
        date,
        steps: saved ? saved.steps : 0,
        goal: saved ? saved.goal : GOAL,
        sources: saved ? normalizeSources(saved.sources) : { motion: 0, sample: 0 },
      };
    });
  }

  function weekday(date) {
    return date.toLocaleDateString('ko-KR', { weekday: 'short' });
  }

  function formatSteps(n) {
    return `${Math.max(0, Math.round(n)).toLocaleString()}보`;
  }

  function sourceText() {
    const parts = [];
    if (state.sources.motion > 0) parts.push(`동작 센서 ${formatSteps(state.sources.motion)}`);
    if (state.sources.sample > 0) parts.push(`샘플 기록 ${formatSteps(state.sources.sample)}`);
    return parts.length ? `출처: ${parts.join(' · ')}` : '출처: 기록 대기';
  }

  function memoFor(ratio) {
    if (ratio >= 1) return '오늘 목표 달성 확인. 선생님의 기록을 주간 보고서에 정갈하게 남겨두겠습니다.';
    if (state.steps >= 4000) return '절반을 넘겼습니다. 무리하지 않는 선에서 오늘 기록을 이어가면 좋겠습니다.';
    if (state.steps > 0) return '오늘의 첫 기록이 남았습니다. 작은 산책도 성실한 루틴으로 보관해둘게요.';
    return '선생님의 산책 기록을 조용히 정리해둘 준비가 되어 있습니다.';
  }

  function renderWeek(records) {
    const total = records.reduce((sum, record) => sum + record.steps, 0);
    els.weekTotal.textContent = formatSteps(total);
    els.weekStamps.textContent = '';
    els.weekBars.textContent = '';

    records.forEach(record => {
      const ratio = Math.min(record.steps / record.goal, 1);
      const stamp = document.createElement('div');
      stamp.className = [
        'stamp',
        record.steps > 0 ? 'walked' : '',
        ratio >= 1 ? 'done' : '',
        dateKey(record.date) === todayKey() ? 'today' : '',
      ].filter(Boolean).join(' ');
      const dot = document.createElement('i');
      const label = document.createElement('span');
      label.textContent = weekday(record.date);
      stamp.appendChild(dot);
      stamp.appendChild(label);
      els.weekStamps.appendChild(stamp);

      const row = document.createElement('div');
      row.className = 'bar-row';
      const day = document.createElement('span');
      day.textContent = weekday(record.date);
      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = `${Math.round(ratio * 100)}%`;
      const steps = document.createElement('span');
      steps.className = 'bar-steps';
      steps.textContent = formatSteps(record.steps);
      track.appendChild(fill);
      row.appendChild(day);
      row.appendChild(track);
      row.appendChild(steps);
      els.weekBars.appendChild(row);
    });
  }

  function render() {
    const ratio = Math.min(state.steps / state.goal, 1);
    const remain = Math.max(state.goal - state.steps, 0);
    els.steps.textContent = state.steps.toLocaleString();
    els.progress.style.strokeDashoffset = CIRC * (1 - ratio);
    els.goalText.textContent = remain > 0
      ? `목표 ${state.goal.toLocaleString()}보까지 ${remain.toLocaleString()}보 남음`
      : `목표 ${state.goal.toLocaleString()}보 달성 완료`;
    els.todayBrief.textContent = state.steps > 0
      ? `오늘 ${formatSteps(state.steps)} 기록, 목표 대비 ${Math.round(ratio * 100)}%입니다.`
      : '아직 오늘 기록이 시작되지 않았습니다.';
    els.sourceNote.textContent = sourceText();
    els.noaMemo.textContent = memoFor(ratio);
    renderWeek(recentRecords());
  }

  function ensureToday() {
    const key = todayKey();
    if (state.currentDateKey === key) return;
    state.currentDateKey = key;
    state.steps = 0;
    state.sources = { motion: 0, sample: 0 };
  }

  function addSteps(amount, source) {
    ensureToday();
    const safeAmount = Math.max(0, Math.round(+amount || 0));
    if (safeAmount <= 0) return;
    state.steps += safeAmount;
    state.sources[source] = Math.max(0, +(state.sources[source] || 0)) + safeAmount;
    els.steps.style.transform = 'scale(1.05)';
    setTimeout(() => { els.steps.style.transform = 'scale(1)'; }, 130);
    render();
    writeRecord();
  }

  function setSensor(on, text) {
    els.sensorDot.classList.toggle('on', on);
    els.sensorText.textContent = text;
  }

  const detector = C.createStepDetector(() => addSteps(1, 'motion'));
  const onMotion = event => detector.handle(event);

  async function start() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          setSensor(false, '센서 권한이 필요합니다');
          return;
        }
      } catch (_) {
        setSensor(false, '센서 권한 요청 실패');
        return;
      }
    }

    if (typeof DeviceMotionEvent === 'undefined') {
      setSensor(false, '이 브라우저는 센서 미지원');
      return;
    }

    window.addEventListener('devicemotion', onMotion);
    state.running = true;
    els.toggle.textContent = '기록 정지';
    els.toggle.classList.add('stop');
    setSensor(true, '기록 중');
    showToast('팬레터 데모 기록을 시작합니다.');
  }

  function stop() {
    window.removeEventListener('devicemotion', onMotion);
    state.running = false;
    els.toggle.textContent = '기록 시작';
    els.toggle.classList.remove('stop');
    setSensor(false, '기록 정지됨');
  }

  let toastTimer;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
      setTimeout(() => els.toast.classList.add('hidden'), 240);
    }, 2400);
  }

  els.toggle.onclick = () => {
    if (state.running) stop();
    else start();
  };

  els.sample.onclick = () => {
    addSteps(500, 'sample');
    showToast('샘플 기록 500보를 추가했습니다.');
  };

  window.addEventListener('beforeunload', writeRecord);
  load();
})();
