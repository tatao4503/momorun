(() => {
  const $ = id => document.getElementById(id);
  const CIRC = 2 * Math.PI * 106; // ≈ 666

  const state = {
    steps: 0,
    goal: 10000,
    running: false,
    lastStepTime: 0
  };

  const STORAGE_PREFIX = 'noa-manbogi-';
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const legacyDateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const todayKey = () => dateKey(new Date());

  function parseRecord(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
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
  function saveNow() {
    clearTimeout(saveTimer);
    localStorage.setItem(todayKey(), JSON.stringify({ steps: state.steps, goal: state.goal }));
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 2000);
  }
  window.addEventListener('beforeunload', saveNow);

  function load() {
    const saved = parseRecord(todayKey()) || parseRecord(legacyDateKey(new Date()));
    state.steps = saved ? Math.max(0, +saved.steps || 0) : 0;
    state.goal = saved ? Math.max(100, +saved.goal || 10000) : +(localStorage.getItem('noa-manbogi-goal') || 10000);
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
    state.steps += n;
    render();
    save();
  }

  // --- Step Detection ---
  let lastMag = 0, smoothed = 0, rising = false, peak = 0, valley = 99;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
    smoothed = smoothed * 0.8 + mag * 0.2;

    const now = e.timeStamp || performance.now();
    if (smoothed > lastMag) {
      rising = true;
      peak = smoothed;
    } else if (smoothed < lastMag && rising) {
      rising = false;
      const amplitude = peak - valley;
      const gap = now - state.lastStepTime;
      if (amplitude > 1.2 && gap > 250 && gap < 2000) {
        state.lastStepTime = now;
        addSteps(1);
        pulse();
      } else if (amplitude > 1.2) {
        state.lastStepTime = now;
      }
      valley = smoothed;
    }
    if (smoothed < valley) valley = smoothed;
    lastMag = smoothed;
  }

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

  async function syncHealthKit() {
    if (window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.Health) {
      try {
        const Health = window.Capacitor.Plugins.Health;
        if (typeof Health.isAvailable === 'function') {
          const avail = await Health.isAvailable();
          if (!avail.available) return;
        }
        if (typeof Health.requestAuthorization === 'function') {
          await Health.requestAuthorization({
            read: ['steps'],
            write: []
          });
        } else if (typeof Health.requestPermissions === 'function') {
          await Health.requestPermissions({
            read: ['steps']
          });
        }
        const today = new Date();
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let hkSteps = 0;
        if (typeof Health.queryAggregated === 'function') {
          const res = await Health.queryAggregated({
            dataType: 'steps',
            startDate: today.toISOString(),
            endDate: tomorrow.toISOString(),
            bucket: 'day'
          });
          if (res && res.samples) {
            res.samples.forEach(s => {
              if (s.value) hkSteps += s.value;
            });
          }
        } else if (typeof Health.query === 'function') {
          const res = await Health.query({
            startDate: today.toISOString(),
            endDate: tomorrow.toISOString(),
            dataType: 'steps',
            limit: 1000
          });
          if (res && res.entries) {
            res.entries.forEach(e => hkSteps += e.value);
          }
        }
        
        hkSteps = Math.round(hkSteps);
        if (hkSteps > state.steps) {
          state.steps = hkSteps;
          render();
          save();
          showToast(`건강 앱 동기화: ${hkSteps.toLocaleString()}보`);
        }
      } catch (err) {
        console.error("HealthKit 동기화 실패:", err);
      }
    }
  }

  async function initBackgroundTasks() {
    if (window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.BackgroundTask) {
      try {
        const BackgroundTask = window.Capacitor.Plugins.BackgroundTask;
        const SYNC_TASK = 'app.capgo.backgroundtask.processing';
        BackgroundTask.defineTask(SYNC_TASK, async () => {
          try {
            await syncHealthKit();
            return 1;
          } catch (e) {
            return 0;
          }
        });
        await BackgroundTask.registerTaskAsync(SYNC_TASK, {
          minimumInterval: 30,
          requiresNetwork: false
        });
      } catch (err) {}
    }
  }

  function setupAppLifecycle() {
    if (window.Capacitor && window.Capacitor.isNative) {
      const App = window.Capacitor.Plugins.App;
      if (App && typeof App.addListener === 'function') {
        App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            syncHealthKit();
          }
        });
      }
    }
    document.addEventListener('resume', () => {
      syncHealthKit();
    });
  }

  load();
  syncHealthKit();
  initBackgroundTasks();
  setupAppLifecycle();
})();
