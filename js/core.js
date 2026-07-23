// 모모런 공유 코어 — 풀버전(app.js)과 라이트(lite.js)가 함께 쓰는 공통 로직.
// 여기만 고치면 두 모드에 동시에 반영된다. (걸음 감지 / HealthKit / 백그라운드 / 저장 헬퍼)
(() => {
  const STORAGE_PREFIX = 'noa-manbogi-';
  const pad = n => String(n).padStart(2, '0');

  function createStorageAdapter() {
    const memory = new Map();
    let nativeStorage = null;

    try {
      nativeStorage = window.localStorage;
      const probeKey = '__momo_run_storage_probe__';
      nativeStorage.setItem(probeKey, '1');
      nativeStorage.removeItem(probeKey);
    } catch (_) {
      nativeStorage = null;
    }

    function nativeKeys() {
      if (!nativeStorage) return [];
      try {
        return Array.from({ length: nativeStorage.length }, (_, index) => nativeStorage.key(index)).filter(Boolean);
      } catch (_) {
        nativeStorage = null;
        return [];
      }
    }

    function keys() {
      return Array.from(new Set([...nativeKeys(), ...memory.keys()]));
    }

    return {
      getItem(key) {
        if (nativeStorage) {
          try {
            const value = nativeStorage.getItem(key);
            if (value !== null) return value;
          } catch (_) {
            nativeStorage = null;
          }
        }
        return memory.has(key) ? memory.get(key) : null;
      },
      setItem(key, value) {
        const normalized = String(value);
        memory.set(key, normalized);
        if (!nativeStorage) return false;
        try {
          nativeStorage.setItem(key, normalized);
          return true;
        } catch (_) {
          nativeStorage = null;
          return false;
        }
      },
      removeItem(key) {
        memory.delete(key);
        if (!nativeStorage) return false;
        try {
          nativeStorage.removeItem(key);
          return true;
        } catch (_) {
          nativeStorage = null;
          return false;
        }
      },
      clear() {
        memory.clear();
        if (!nativeStorage) return false;
        try {
          nativeStorage.clear();
          return true;
        } catch (_) {
          nativeStorage = null;
          return false;
        }
      },
      key(index) {
        return keys()[index] || null;
      },
      keys,
      get length() {
        return keys().length;
      },
      get persistent() {
        return Boolean(nativeStorage);
      },
    };
  }

  const storage = createStorageAdapter();

  function isNativePlatform() {
    const Capacitor = window.Capacitor;
    if (!Capacitor) return false;
    try {
      if (typeof Capacitor.isNativePlatform === 'function') return Capacitor.isNativePlatform();
      if (typeof Capacitor.getPlatform === 'function') return Capacitor.getPlatform() !== 'web';
    } catch (_) {
      return false;
    }
    return false;
  }

  function getNativePlugin(name) {
    const Capacitor = window.Capacitor;
    if (!isNativePlatform() || !Capacitor || !Capacitor.Plugins) return null;
    try {
      if (typeof Capacitor.isPluginAvailable === 'function' && !Capacitor.isPluginAvailable(name)) return null;
    } catch (_) {
      return null;
    }
    return Capacitor.Plugins[name] || null;
  }
  
  function toLocalISOString(date) {
    const tzOffset = -date.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad2 = num => String(Math.floor(Math.abs(num))).padStart(2, '0');
    return date.getFullYear() +
      '-' + pad2(date.getMonth() + 1) +
      '-' + pad2(date.getDate()) +
      'T' + pad2(date.getHours()) +
      ':' + pad2(date.getMinutes()) +
      ':' + pad2(date.getSeconds()) +
      '.' + String((date.getMilliseconds() / 1000).toFixed(3)).slice(2, 5) +
      diff + pad2(tzOffset / 60) +
      ':' + pad2(tzOffset % 60);
  }

  const dateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const legacyDateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const todayKey = () => dateKey(new Date());
  const fallbackGoal = () => Math.max(100, +(storage.getItem('noa-manbogi-goal') || 10000) || 10000);

  // 안전 저장: 사파리 사생활 모드/용량 초과 등으로 setItem이 throw해도 앱이 죽지 않게.
  // 성공 true / 실패 false 반환.
  function safeSet(key, value) {
    const ok = storage.setItem(key, value);
    if (!ok) console.warn('영구 저장소를 사용할 수 없어 메모리 저장으로 전환했습니다:', key);
    return ok;
  }

  function parseRecord(key) {
    try {
      const raw = storage.getItem(key);
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
  async function syncHealthKit({ getSteps, setSteps, onSynced, requestAuthorization = false }) {
    const Health = getNativePlugin('Health');
    if (!Health) return { ok: false, reason: 'unavailable' };
    try {
      if (typeof Health.isAvailable === 'function') {
        const avail = await Health.isAvailable();
        if (!avail.available) {
          console.warn('Health access is not available:', avail.reason);
          return { ok: false, reason: 'unavailable' };
        }
      }

      let authorization = null;
      if (requestAuthorization && typeof Health.requestAuthorization === 'function') {
        authorization = await Health.requestAuthorization({ read: ['steps'], write: [] });
      } else if (typeof Health.checkAuthorization === 'function') {
        authorization = await Health.checkAuthorization({ read: ['steps'], write: [] });
      } else if (typeof Health.requestAuthorization === 'function') {
        authorization = await Health.requestAuthorization({ read: ['steps'], write: [] });
      }
      if (authorization && Array.isArray(authorization.readDenied) && authorization.readDenied.includes('steps')) {
        return { ok: false, reason: 'permission-denied' };
      }

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      let hkSteps = 0;
      if (typeof Health.queryAggregated === 'function') {
        const res = await Health.queryAggregated({
          dataType: 'steps', startDate: toLocalISOString(today), endDate: toLocalISOString(tomorrow), bucket: 'day'
        });
        if (res && res.samples) res.samples.forEach(s => { if (s.value) hkSteps += s.value; });
      } else if (typeof Health.readSamples === 'function') {
        const res = await Health.readSamples({
          startDate: toLocalISOString(today), endDate: toLocalISOString(tomorrow), dataType: 'steps', limit: 1000
        });
        if (res && res.samples) res.samples.forEach(sample => { if (sample.value) hkSteps += sample.value; });
      }
      hkSteps = Math.round(hkSteps);
      const synced = hkSteps > getSteps();
      if (synced) {
        setSteps(hkSteps);
        if (onSynced) onSynced(hkSteps);
      }
      return { ok: true, steps: hkSteps, synced };
    } catch (err) {
      console.error('HealthKit 동기화 실패:', err);
      return { ok: false, reason: 'error' };
    }
  }

  let backgroundTaskInitialization = null;

  async function initBackgroundTasks(syncFn) {
    const BackgroundTask = getNativePlugin('BackgroundTask');
    if (!BackgroundTask) return false;
    if (backgroundTaskInitialization) return backgroundTaskInitialization;

    backgroundTaskInitialization = (async () => {
      const SYNC_TASK = 'app.capgo.backgroundtask.processing';
      const SUCCESS = 1;
      const FAILED = 2;
      const processedTaskIds = new Set();
      const expiredTaskIds = new Set();

      async function finishTask(event, result) {
        if (!event || !event.taskId || typeof BackgroundTask.finish !== 'function') return;
        await BackgroundTask.finish({ taskId: event.taskId, taskName: event.taskName || SYNC_TASK, result });
      }

      async function runTask(event) {
        if (!event || event.taskName !== SYNC_TASK || !event.taskId || processedTaskIds.has(event.taskId)) return;
        processedTaskIds.add(event.taskId);
        let result = SUCCESS;
        try {
          const syncResult = await syncFn();
          if (syncResult && syncResult.ok === false) result = FAILED;
        } catch (err) {
          result = FAILED;
          console.error('Background sync failed:', err);
        }
        if (!expiredTaskIds.has(event.taskId)) await finishTask(event, result);
      }

      if (typeof BackgroundTask.addListener !== 'function'
          || typeof BackgroundTask.registerTask !== 'function'
          || typeof BackgroundTask.finish !== 'function') {
        throw new Error('BackgroundTask native bridge is incomplete');
      }

      await BackgroundTask.addListener('backgroundTask', event => runTask(event));
      await BackgroundTask.addListener('expiration', event => {
        if (!event || !event.taskId) return;
        expiredTaskIds.add(event.taskId);
        return finishTask(event, FAILED);
      });

      if (typeof BackgroundTask.getPendingTaskRuns === 'function') {
        const pending = await BackgroundTask.getPendingTaskRuns();
        await Promise.all(((pending && pending.tasks) || []).map(event => runTask(event)));
      }

      await BackgroundTask.registerTask({
        taskName: SYNC_TASK,
        options: { minimumInterval: 30, requiresNetwork: false }
      });
      return true;
    })().catch(err => {
      backgroundTaskInitialization = null;
      console.error('Background Task 등록 실패:', err);
      return false;
    });

    return backgroundTaskInitialization;
  }

  function setupAppLifecycle(syncFn) {
    const App = getNativePlugin('App');
    if (App && typeof App.addListener === 'function') {
      App.addListener('appStateChange', (st) => { if (st.isActive) syncFn(); })
        .catch(err => console.warn('앱 생명주기 연결 실패:', err));
    }
    document.addEventListener('resume', () => syncFn());
  }

  function registerServiceWorker() {
    const hasManifest = document.querySelector('link[rel="manifest"]');
    if (!hasManifest || !('serviceWorker' in navigator) || !/^https?:$/.test(window.location.protocol)) {
      return Promise.resolve(null);
    }
    return navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('서비스 워커 등록 실패:', err && err.message);
      return null;
    });
  }

  window.NoaCore = {
    STORAGE_PREFIX,
    CIRC: 2 * Math.PI * 106, // ≈ 666
    pad, dateKey, legacyDateKey, todayKey, fallbackGoal, parseRecord, safeSet, storage,
    isNativePlatform, getNativePlugin, createStepDetector, syncHealthKit,
    initBackgroundTasks, setupAppLifecycle, registerServiceWorker,
  };
})();
