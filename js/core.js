// 모모런 공유 코어 — 풀버전(app.js)과 라이트(lite.js)가 함께 쓰는 공통 로직.
// 여기만 고치면 두 모드에 동시에 반영된다. (걸음 감지 / HealthKit / 백그라운드 / 저장 헬퍼)
(() => {
  const STORAGE_PREFIX = 'noa-manbogi-';
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const legacyDateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const todayKey = () => dateKey(new Date());
  const fallbackGoal = () => Math.max(100, +(localStorage.getItem('noa-manbogi-goal') || 10000) || 10000);

  function parseRecord(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
	      const o = JSON.parse(raw);
	      return {
	        steps: Math.max(0, +o.steps || 0),
	        goal: Math.max(100, +o.goal || fallbackGoal()),
	        sources: o.sources && typeof o.sources === 'object' ? {
	          sensor: Math.max(0, +o.sources.sensor || 0),
	          health: Math.max(0, +o.sources.health || 0),
	          test: Math.max(0, +o.sources.test || 0),
	          dev: Math.max(0, +o.sources.dev || 0),
	        } : { sensor: 0, health: 0, test: 0, dev: 0 },
	        lastSource: typeof o.lastSource === 'string' ? o.lastSource : '',
	        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '',
	      };
    } catch (_) {
      return null;
    }
  }

  // 가속도 피크 카운팅 걸음 감지기. onStep은 걸음 1회마다 호출.
  function createStepDetector(onStep) {
    let lastMag = 0, smoothed = 0, rising = false, peak = 0, valley = 99, lastStepTime = 0;
    function handle(e) {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      smoothed = smoothed * 0.8 + mag * 0.2; // low-pass filter
      const now = e.timeStamp || performance.now();
      if (smoothed > lastMag) {
        rising = true;
        peak = smoothed;
      } else if (smoothed < lastMag && rising) {
        rising = false;
        const amplitude = peak - valley;
        const gap = now - lastStepTime;
        // 진폭 > 1.2 m/s², 걸음 간격 250ms~2000ms
        if (amplitude > 1.2 && gap > 250 && gap < 2000) {
          lastStepTime = now;
          onStep();
        } else if (amplitude > 1.2) {
          lastStepTime = now;
        }
        valley = smoothed;
      }
      if (smoothed < valley) valley = smoothed;
      lastMag = smoothed;
    }
    function reset() { lastMag = 0; smoothed = 0; rising = false; peak = 0; valley = 99; lastStepTime = 0; }
    return { handle, reset };
  }

  // HealthKit 동기화 (네이티브 Capacitor 환경에서만 동작).
  // getSteps(): 현재 앱 걸음 수, setSteps(n): 앱 상태 갱신, onSynced(n): 동기화 후 콜백
  async function syncHealthKit({ getSteps, setSteps, onSynced }) {
    if (!(window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.Health)) return;
    try {
      const Health = window.Capacitor.Plugins.Health;
      if (typeof Health.isAvailable === 'function') {
        const avail = await Health.isAvailable();
        if (!avail.available) {
          console.warn('Health access is not available:', avail.reason);
          return;
        }
      }
      if (typeof Health.requestAuthorization === 'function') {
        await Health.requestAuthorization({ read: ['steps'], write: [] });
      } else if (typeof Health.requestPermissions === 'function') {
        await Health.requestPermissions({ read: ['steps'] });
      }
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      let hkSteps = 0;
      if (typeof Health.queryAggregated === 'function') {
        const res = await Health.queryAggregated({
          dataType: 'steps', startDate: today.toISOString(), endDate: tomorrow.toISOString(), bucket: 'day'
        });
        if (res && res.samples) res.samples.forEach(s => { if (s.value) hkSteps += s.value; });
      } else if (typeof Health.query === 'function') {
        const res = await Health.query({
          startDate: today.toISOString(), endDate: tomorrow.toISOString(), dataType: 'steps', limit: 1000
        });
        if (res && res.entries) res.entries.forEach(e => hkSteps += e.value);
      }
      hkSteps = Math.round(hkSteps);
      if (hkSteps > getSteps()) {
        setSteps(hkSteps);
        if (onSynced) onSynced(hkSteps);
      }
    } catch (err) {
      console.error('HealthKit 동기화 실패:', err);
    }
  }

  async function initBackgroundTasks(syncFn) {
    if (!(window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.BackgroundTask)) return;
    try {
      const BackgroundTask = window.Capacitor.Plugins.BackgroundTask;
      const SYNC_TASK = 'app.capgo.backgroundtask.processing';
      BackgroundTask.defineTask(SYNC_TASK, async () => {
        try { await syncFn(); return 1; } catch (e) { console.error('Background sync failed:', e); return 0; }
      });
      await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 30, requiresNetwork: false });
    } catch (err) {
      console.error('Background Task 등록 실패:', err);
    }
  }

  function setupAppLifecycle(syncFn) {
    if (window.Capacitor && window.Capacitor.isNative) {
      const App = window.Capacitor.Plugins.App;
      if (App && typeof App.addListener === 'function') {
        App.addListener('appStateChange', (st) => { if (st.isActive) syncFn(); });
      }
    }
    document.addEventListener('resume', () => syncFn());
  }

  window.NoaCore = {
    STORAGE_PREFIX,
    CIRC: 2 * Math.PI * 106, // ≈ 666
    pad, dateKey, legacyDateKey, todayKey, fallbackGoal, parseRecord,
    createStepDetector, syncHealthKit, initBackgroundTasks, setupAppLifecycle,
  };
})();
