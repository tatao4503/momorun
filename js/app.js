(() => {
  const $ = id => document.getElementById(id);

  function installDevErrorOverlay() {
    const params = new URLSearchParams(window.location.search);
    const enabled = params.has('debug') || localStorage.getItem('noa-dev-error-overlay') === '1';
    if (!enabled) return;

    function showDebugOverlay(title, details, level = 'error') {
      const div = document.getElementById('debug-err-console') || document.createElement('div');
      div.id = 'debug-err-console';
      div.textContent = '';
      Object.assign(div.style, {
        position: 'fixed',
        bottom: '0',
        left: '0',
        width: '100%',
        background: level === 'promise' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(239, 68, 68, 0.95)',
        color: '#fff',
        padding: '12px',
        fontSize: '12px',
        zIndex: '9999999',
        maxHeight: '150px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
      });

      const strong = document.createElement('strong');
      strong.textContent = title;
      div.appendChild(strong);
      div.appendChild(document.createElement('br'));
      div.appendChild(document.createTextNode(details));

      const attach = () => {
        if (!div.parentNode) document.body.appendChild(div);
      };
      if (document.body) attach();
      else window.addEventListener('DOMContentLoaded', attach, { once: true });
    }

    window.addEventListener('error', event => {
      const stack = event.error && event.error.stack ? `\n${event.error.stack}` : '';
      showDebugOverlay('JS Error:', `${event.message}\nat ${event.filename}:${event.lineno}:${event.colno}${stack}`);
    });
    window.addEventListener('unhandledrejection', event => {
      showDebugOverlay('Promise Reject:', String(event.reason), 'promise');
    });
  }

  installDevErrorOverlay();

  const C = window.NoaCore;
  const CIRC = C.CIRC;

	  const state = {
	    steps: 0,
	    goal: 10000,
	    running: false,
	    lastStepTime: 0,
		    goalReachedToday: false,
		    easterEggShown: false,
		    currentDateKey: null,
		    sources: { sensor: 0, health: 0, test: 0, dev: 0 },
		    lastSource: ''
		  };
		
		  // ---- daily persistence ----
	  // 공통 저장/날짜 헬퍼는 core.js(NoaCore)에서 가져온다.
	  const { STORAGE_PREFIX, pad, dateKey, legacyDateKey, todayKey, fallbackGoal, parseRecord } = C;
	  const SOURCE_LABELS = {
	    sensor: '동작 센서',
	    health: 'HealthKit',
	    test: '테스트 입력',
	    dev: '개발자 입력',
	  };
	  const makeEmptySources = () => ({ sensor: 0, health: 0, test: 0, dev: 0 });
	  function normalizeSources(sources) {
	    return {
	      sensor: Math.max(0, +(sources && sources.sensor) || 0),
	      health: Math.max(0, +(sources && sources.health) || 0),
	      test: Math.max(0, +(sources && sources.test) || 0),
	      dev: Math.max(0, +(sources && sources.dev) || 0),
	    };
	  }
	  function sourceSummary(sources, totalSteps = 0) {
	    const s = normalizeSources(sources);
	    const parts = Object.keys(SOURCE_LABELS)
	      .filter(key => s[key] > 0)
	      .map(key => `${SOURCE_LABELS[key]} ${s[key].toLocaleString()}보`);
	    if (!parts.length && totalSteps > 0) return '출처: 이전 버전 기록';
	    return parts.length ? `출처: ${parts.join(' · ')}` : '출처: 기록 대기';
	  }
	  function markSource(source, amount) {
	    const safeSource = SOURCE_LABELS[source] ? source : 'sensor';
	    const safeAmount = Math.max(0, Math.round(+amount || 0));
	    if (safeAmount <= 0) return;
	    state.sources = normalizeSources(state.sources);
	    state.sources[safeSource] += safeAmount;
	    state.lastSource = safeSource;
	  }
	  function recordFor(date) {
	    return parseRecord(dateKey(date)) || parseRecord(legacyDateKey(date)) || { steps: 0, goal: fallbackGoal() };
	  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function recentRecords() {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const rec = isSameDay(d, today) ? { steps: state.steps, goal: state.goal } : recordFor(d);
      return { date: d, ...rec };
    });
  }

  // 효율화: 매 걸음마다 localStorage 전체를 뒤지지 않도록 누적 걸음수를 캐싱
  let cachedBaseLifetimeSteps = null;

  function getLifetimeSteps() {
    if (cachedBaseLifetimeSteps === null) {
      let base = localStorage.getItem('noa-manbogi-lifetime-base');
      if (base === null) {
        // 첫 1회 마이그레이션 (O(N) 계산 후 단일 키 보관)
        let calculatedBase = 0;
        const todayStr = dateKey(new Date());
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith(STORAGE_PREFIX) && k !== todayStr && k !== 'noa-manbogi-goal' && k !== 'noa-manbogi-voice') {
            const rec = parseRecord(k);
            if (rec) calculatedBase += rec.steps;
          }
        }
        localStorage.setItem('noa-manbogi-lifetime-base', calculatedBase);
        base = calculatedBase;
      } else {
        base = +base || 0;
      }
      cachedBaseLifetimeSteps = base;
    }
    return cachedBaseLifetimeSteps + state.steps;
  }

  function getAffectionLevel(totalSteps) {
    if (totalSteps >= 500000) return { level: 5, title: '선생님 전속 서기' };
    if (totalSteps >= 100000) return { level: 4, title: '발걸음의 동반자' };
    if (totalSteps >= 50000) return { level: 3, title: '믿음직한 기록자' };
    if (totalSteps >= 10000) return { level: 2, title: '성실한 관찰자' };
    return { level: 1, title: '기록의 시작' };
  }

	  let chartInstance = null;
	  function updateChart(records) {
	    if (typeof Chart === 'undefined') {
	      console.warn('Chart.js is not defined.');
	      return;
	    }
	    const chartCanvas = document.getElementById('weekChart');
	    if (!chartCanvas) return;
	    const ctx = chartCanvas.getContext('2d');
	    if (!ctx) return;
    const labels = records.map(r => r.date.toLocaleDateString('ko-KR', { weekday: 'short' }));
    const data = records.map(r => r.steps);
    
    if (chartInstance) {
      chartInstance.data.datasets[0].data = data;
      chartInstance.update();
    } else {
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: '걸음 수',
            data: data,
            backgroundColor: 'rgba(167, 139, 250, 0.6)',
            borderColor: 'rgba(167, 139, 250, 1)',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#b4bddc' } },
            x: { grid: { display: false }, ticks: { color: '#b4bddc' } }
          }
        }
      });
    }
  }

	  // LocalStorage I/O Debouncing
  let saveTimer = null;
	  let storageWarned = false;
	  function saveNow() {
	    clearTimeout(saveTimer);
	    const ok1 = C.safeSet(todayKey(), JSON.stringify({
	      steps: state.steps,
	      goal: state.goal,
	      sources: normalizeSources(state.sources),
	      lastSource: state.lastSource,
	      updatedAt: new Date().toISOString(),
	    }));
	    const ok2 = C.safeSet('noa-manbogi-goal', state.goal);
	    if (!ok1 || !ok2) {
	      if (!storageWarned) {
	        storageWarned = true;
	        $('msg').textContent = '기록을 저장할 수 없어요. 사생활 모드인지, 저장 공간이 충분한지 확인해 주세요.';
	      }
	      return;
	    }
	    storageWarned = false;
	    checkPyroxenes();
	  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 2000);
  }
  window.addEventListener('beforeunload', saveNow);

  // 우측 통계(보스 HP·연속일·주간합계·랭크·차트)는 비싸므로 throttle해서 갱신
  let historyTimer = null;
  function refreshHistorySoon() {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => renderHistory(Math.min(state.steps / state.goal, 1)), 700);
  }
	  function load() {
        state.currentDateKey = todayKey();
		    const saved = parseRecord(todayKey()) || parseRecord(legacyDateKey(new Date()));
		    state.steps = saved ? saved.steps : 0;
		    state.goal = saved ? saved.goal : fallbackGoal();
		    state.sources = saved ? normalizeSources(saved.sources) : makeEmptySources();
		    state.lastSource = saved ? saved.lastSource || '' : '';
	    if (state.steps >= state.goal) state.goalReachedToday = true;
	    if (state.steps >= 4130) state.easterEggShown = true;
	    $('goal').value = state.goal;
	    // 첫 로드 시점엔 현재 레벨로 동기화(잘못된 레벨업 연출 방지)
	    lastAffectionLevel = getAffectionLevel(getLifetimeSteps()).level;
	    localStorage.setItem('noa-affection-level', lastAffectionLevel);
		  }

	  // --- 실시간 날씨 연동 (Open-Meteo) ---
	  let weatherState = null;
	  function setWeatherChip(label, value, options = {}) {
	    const btn = $('weather-btn');
	    const icon = $('weather-icon');
	    const temp = $('weather-temp');
	    if (!btn || !icon || !temp) return;
	    icon.textContent = label;
	    temp.textContent = value;
	    btn.disabled = Boolean(options.disabled);
	    btn.classList.toggle('on', Boolean(options.on));
	  }
	  async function fetchWeather() {
	    if (!navigator.geolocation) {
	      setWeatherChip('날씨', '미지원');
	      return;
	    }
	    setWeatherChip('위치', '확인 중', { disabled: true });
	    navigator.geolocation.getCurrentPosition(async (pos) => {
	      try {
	        const lat = pos.coords.latitude;
	        const lon = pos.coords.longitude;
	        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
	        const data = await res.json();
	        if (!data.current_weather) throw new Error('No current_weather in Open-Meteo response');
	        const code = data.current_weather.weathercode;
	        const temp = data.current_weather.temperature;
	        
	        let wIcon = '맑음'; let wType = 'clear';
	        if (code >= 1 && code <= 3) { wIcon = '흐림'; wType = 'cloudy'; }
	        else if (code >= 51 && code <= 67) { wIcon = '비'; wType = 'rain'; }
	        else if (code >= 71 && code <= 77) { wIcon = '눈'; wType = 'snow'; }
	        
	        weatherState = wType;
	        setWeatherChip(wIcon, Math.round(temp) + '°C', { on: true });
	        updateSetupChecklist();
	        
	        // 날씨에 따른 특수 모모톡 대사 (처음에만)
	        if (shownMile < 0 && state.steps < 100) {
	          if (wType === 'rain') setTimeout(() => showMomotalk("비가 오네요, 선생님. 우산은 꼭 챙기셨죠? 미끄러지지 않게 조심하세요."), 1000);
	          else if (wType === 'snow') setTimeout(() => showMomotalk("눈이 내리고 있어요! 샬레 밖이 새하얗네요. 빙판길 조심해서 출발할까요?"), 1000);
	        }
	      } catch(e) {
	        console.error('Weather fetch error', e);
	        weatherState = null;
	        setWeatherChip('날씨', '오류');
	        updateSetupChecklist();
	      } finally {
	        const btn = $('weather-btn');
	        if (btn) btn.disabled = false;
	      }
	    }, () => {
	      weatherState = null;
	      setWeatherChip('날씨', '권한 필요');
	      updateSetupChecklist();
	    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
	  }

  // ---- UI ----
  // --- 시간대 처리 및 대사 ---
  const hour = new Date().getHours();
  let timeClass = 'time-morning';
  let greetingLines = [];
  if (hour >= 5 && hour < 12) {
    timeClass = 'time-morning';
    greetingLines = ["좋은 아침이에요, 선생님. 오늘도 힘차게 걸어볼까요?", "아침 기록을 시작할 준비가 됐어요."];
  } else if (hour >= 12 && hour < 18) {
    timeClass = 'time-afternoon';
    greetingLines = ["점심은 드셨나요? 나른한 오후에도 기록은 계속됩니다.", "기록할 준비됐어요. 오늘도 시작할까요, 선생님?"];
  } else {
    timeClass = 'time-night';
    greetingLines = ["밤이 늦었네요. 기록은 제게 맡기고 쉬셔도 좋아요.", "오늘 하루도 수고 많으셨어요, 선생님."];
  }
  document.body.classList.add(timeClass);

  const noaLines = {
    greeting: greetingLines,
    start: [
      "측정 시작할게요. 기록은 제게 맡기세요.",
      "한 걸음도 놓치지 않고 적어 둘게요.",
      "기록대로, 완벽하게. 가볼까요, 선생님?",
    ],
    stop: [
      "여기까지 기록해 뒀어요. 언제든 이어서 하시면 돼요.",
      "잠깐 쉬어가도 괜찮아요. 기록은 그대로 남아 있어요.",
    ],
    memorial: [
      "선생님, 그렇게 빤히 바라보시면 기록하는 손이 멈춰버린답니다.",
      "서기인 저도 모르게, 선생님의 얼굴을 넋 놓고 바라볼 뻔했어요. 이건 비밀 기록이랍니다?",
      "오늘 하루도 고생 많으셨어요. 지금만큼은 일도, 기록도 다 잊고 제 곁에서 쉬어가시는 건 어떨까요?",
      "선생님과 함께 걷는 이 길을 매 걸음마다 제 마음속 깊이 적어두고 있어요.",
      "선생님의 손길... 참 따뜻하네요. 앞으로도 계속 곁에서 적어두게 해주세요."
    ]
  };
  const milestones = [
    { p: 0.25, t: "좋은 출발이에요, 선생님. 순조롭게 적히고 있어요." },
    { p: 0.50, t: "절반 지점이에요. 기록은 정확하게 남기고 있어요." },
    { p: 0.75, t: "조금만 더예요. 끝까지 함께 기록할게요." },
    { p: 1.00, t: "수고하셨습니다, 선생님." },
  ];
		  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
	  function pickLine(arr) {
	    if (!Array.isArray(arr) || arr.length === 0) return '';
	    let recent = [];
	    try { recent = JSON.parse(localStorage.getItem('noa-recent-lines')) || []; } catch (e) {}
	    const candidates = arr.filter(line => !recent.includes(line));
	    const line = pick(candidates.length ? candidates : arr);
	    recent = [line, ...recent.filter(item => item !== line)].slice(0, 8);
	    localStorage.setItem('noa-recent-lines', JSON.stringify(recent));
	    return line;
	  }
  const milestoneIndexFor = ratio => {
    let idx = -1;
    milestones.forEach((m, i) => { if (ratio >= m.p) idx = i; });
    return idx;
  };
  let shownMile = -1;
  let lastAffectionLevel = +(localStorage.getItem('noa-affection-level') || 1);

  function celebrate(colors) {
    if (typeof confetti !== 'function') return;
    confetti({ particleCount: 160, spread: 75, origin: { y: 0.6 }, colors, zIndex: 9999 });
  }

  // 오프라인 안전한 효과음 (Web Audio API — 외부 URL 불필요)
  function playBeep(freq = 800, dur = 80, vol = 0.3) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
      osc.stop(ctx.currentTime + dur / 1000);
    } catch (_) {}
  }

	  // --- 음성 ---
	  // 진짜 노아 보이스 클립을 쓰려면 voice/ 폴더에 mp3를 넣고 아래 맵에 "대사": "voice/파일.mp3" 추가.
	  // 매핑이 없으면 브라우저 음성합성(TTS)으로 자동 대체.
    let currentSpeakAudio = null;
    let LOCAL_VOICE_PACK_READY = false;
	  const VOICE_CLIPS = {
    "기록할 준비됐어요. 오늘도 시작할까요, 선생님?": "voice/greeting1.mp3",
    "선생님의 걸음, 한 걸음도 빠짐없이 기억해 둘게요.": "voice/greeting2.mp3",
    "오늘은 몇 보까지 걸으실 생각이세요?": "voice/greeting3.mp3",
    "측정 시작할게요. 기록은 제게 맡기세요.": "voice/start1.mp3",
    "한 걸음도 놓치지 않고 적어 둘게요.": "voice/start2.mp3",
    "기록대로, 완벽하게. 가볼까요, 선생님?": "voice/start3.mp3",
    "여기까지 기록해 뒀어요. 언제든 이어서 하시면 돼요.": "voice/stop1.mp3",
    "잠깐 쉬어가도 괜찮아요. 기록은 그대로 남아 있어요.": "voice/stop2.mp3",
    "좋은 출발이에요, 선생님. 순조롭게 적히고 있어요.": "voice/mile1.mp3",
    "절반 지점이에요. 기록은 정확하게 남기고 있어요.": "voice/mile2.mp3",
    "조금만 더예요. 끝까지 함께 기록할게요.": "voice/mile3.mp3",
    "수고하셨습니다, 선생님.": "voice/goal.mp3",
    "음성을 켰어요, 선생님.": "voice/voice_on.mp3"
  };
	  let voiceOn = localStorage.getItem('noa-manbogi-voice') === '1' || localStorage.getItem('momorun-voice') === '1';
  let GEMINI_API_KEY = localStorage.getItem('noa-gemini-key') || '';
  let ELEVENLABS_API_KEY = localStorage.getItem('noa-elevenlabs-key') || '';
  let ELEVENLABS_VOICE_ID = localStorage.getItem('noa-elevenlabs-voice') || '';
  function ttsSpeak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; 
    u.rate = 1.05; // 살짝 빠르게 속도 튜닝
    u.pitch = 1.12; // 톤 보정을 위해 피치 튜닝
    
    // 기기 내장 프리미엄 한국어 음성 필터링 (Apple Yuna / Siri 등)
    if (typeof speechSynthesis.getVoices === 'function') {
      const voices = speechSynthesis.getVoices();
      const koVoice = voices.find(v => v.lang.includes('ko-KR') && (v.name.includes('Yuna') || v.name.includes('Siri') || v.name.includes('Premium')))
                      || voices.find(v => v.lang.includes('ko-KR'));
      if (koVoice) u.voice = koVoice;
    }
    speechSynthesis.speak(u);
  }

  async function checkLocalVoicePack() {
    try {
      // 대표 오디오 클립 greeting1.mp3의 실제 존재(서빙) 여부를 동적으로 탐색
      const response = await fetch('voice/greeting1.mp3', { method: 'GET', cache: 'no-store' });
      LOCAL_VOICE_PACK_READY = response.ok;
    } catch (_) {
      LOCAL_VOICE_PACK_READY = false;
    }
    updateVoiceBtn();
  }
  async function speak(text) {
    if (!voiceOn || !text) return;
    
    if (currentSpeakAudio) {
      try {
        currentSpeakAudio.pause();
        currentSpeakAudio.currentTime = 0;
      } catch (_) {}
    }
    
    // ElevenLabs API 실시간 통신
    if (ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID) {
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          currentSpeakAudio = a;
          a.play();
          return;
        } else {
          console.error("ElevenLabs API 에러:", await response.text());
        }
      } catch (err) {
        console.error("ElevenLabs 연결 실패", err);
      }
    }

	    // API 키가 없거나 실패한 경우 로컬 파일 또는 기본 TTS로 폴백
	    const clip = VOICE_CLIPS[text];
	    if (LOCAL_VOICE_PACK_READY && clip) {
	      const a = new Audio(clip);
	      currentSpeakAudio = a;
	      a.play().catch(() => ttsSpeak(text));
	    } else {
	      ttsSpeak(text);
	    }
  }
  function updateVoiceBtn() {
	    const b = $('voice');
	    b.textContent = voiceOn ? '노아 음성: ON' : '노아 음성: OFF';
	    b.classList.toggle('on', voiceOn);
	    b.title = LOCAL_VOICE_PACK_READY
	      ? '로컬 보이스팩을 우선 재생합니다.'
	      : '로컬 보이스팩이 없어 ElevenLabs 또는 브라우저 TTS로 재생합니다.';
	  }

	  function say(text) {
	    const m = $('msg');
	    m.style.opacity = 0;
	    setTimeout(() => { m.textContent = text; m.style.opacity = 1; }, 160);
	    speak(text);
	  }
	  function phaseFor(ratio) {
	    if (state.steps <= 0) return '기록 준비';
	    if (ratio >= 1) return '목표 완료';
	    if (ratio >= 0.75) return '마감 기록 중';
	    if (ratio >= 0.5) return '절반 통과';
	    if (ratio >= 0.25) return '순조롭게 기록 중';
	    return '기록 개시';
	  }
	  function weekdayLabel(date) {
	    return date.toLocaleDateString('ko-KR', { weekday: 'short' });
	  }
	  function weeklyMetrics(records) {
	    const weekTotal = records.reduce((sum, r) => sum + r.steps, 0);
	    const goalDays = records.filter(r => r.steps >= r.goal).length;
	    const best = records.reduce((max, r) => r.steps > max.steps ? r : max, records[0] || { steps: 0, date: new Date(), goal: state.goal });
	    let streak = 0;
	    for (let i = records.length - 1; i >= 0; i--) {
	      if (records[i].steps <= 0) break;
	      streak++;
	    }
	    return { weekTotal, goalDays, best, streak };
	  }
	  function nextWeeklyTarget(metrics) {
	    if (metrics.goalDays >= 5) return '다음 주는 목표 달성 6일을 노려도 좋겠습니다.';
	    if (metrics.weekTotal >= state.goal * 4) return '다음 주는 하루 더 목표 달성일을 늘려봅시다.';
	    if (state.steps > 0) return '내일은 오늘 기록을 기준으로 1,000보만 더해볼까요?';
	    return '첫 기록은 10분 산책부터 시작해도 충분합니다.';
	  }
	  function buildNoaMemo(metrics, ratio) {
	    const sourceText = sourceSummary(state.sources, state.steps).replace('출처: ', '');
	    if (ratio >= 1) return `목표 달성 확인. ${SOURCE_LABELS[state.lastSource] || '기록'} 기준으로 오늘 기록은 결재 가능한 상태입니다.`;
	    if (metrics.streak >= 3) return `연속 ${metrics.streak}일 기록 중입니다. 작은 루틴이 이미 꽤 단단하게 쌓이고 있어요.`;
	    if (state.steps > 0) return `오늘 기록은 ${sourceText} 기준으로 정리했습니다. 남은 걸음은 무리하지 않는 선에서 채워도 좋습니다.`;
	    return '아직 오늘 기록은 비어 있습니다. 측정 시작을 누르면 제가 바로 서류를 열어둘게요.';
	  }
	  function renderBriefing(records, ratio) {
	    const metrics = weeklyMetrics(records);
	    const remain = Math.max(state.goal - state.steps, 0);
	    const todayBrief = $('todayBrief');
	    const weeklyBrief = $('weeklyBrief');
	    const sourceNote = $('sourceNote');
	    const weeklyBest = $('weeklyBest');
	    const weeklyNext = $('weeklyNext');
	    const noaMemo = $('noaMemo');
	    if (todayBrief) {
	      todayBrief.textContent = state.steps > 0
	        ? `${state.steps.toLocaleString()}보 기록, 목표 대비 ${Math.round(ratio * 100)}%입니다. ${remain > 0 ? `${remain.toLocaleString()}보 남았습니다.` : '오늘 목표는 완료되었습니다.'}`
	        : '아직 오늘 기록이 시작되지 않았습니다.';
	    }
	    if (weeklyBrief) {
	      weeklyBrief.textContent = `최근 7일 누적 ${metrics.weekTotal.toLocaleString()}보, 목표 달성 ${metrics.goalDays}일, 연속 기록 ${metrics.streak}일입니다.`;
	    }
	    if (sourceNote) sourceNote.textContent = sourceSummary(state.sources, state.steps);
	    if (weeklyBest) weeklyBest.textContent = `최고 기록: ${weekdayLabel(metrics.best.date)} ${metrics.best.steps.toLocaleString()}보`;
	    if (weeklyNext) weeklyNext.textContent = `다음 목표: ${nextWeeklyTarget(metrics)}`;
	    if (noaMemo) noaMemo.textContent = buildNoaMemo(metrics, ratio);
	  }
	  
	  // --- DOM Caching ---
  const els = {
    steps: $('steps'),
    prog: $('prog'),
    goaltxt: $('goaltxt'),
    dist: $('dist'),
    kcal: $('kcal'),
    pct: $('pct'),
    todayRecord: $('todayRecord'),
    phase: $('phase'),
    ring: document.querySelector('.ring')
  };
  
  // --- 주간 총력전 (Raid Boss) ---
  function renderRaidBoss(weekTotalSteps) {
    const bossGoal = state.goal * 7;
    const hpRemaining = Math.max(bossGoal - weekTotalSteps, 0);
    const hpPct = Math.max((hpRemaining / bossGoal) * 100, 0);
    
    $('raid-boss-hp-bar').style.width = hpPct + '%';
    $('raid-boss-hp-text').textContent = Math.round(hpPct) + '%';
    
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); // 이번주 월요일
    const weekId = `noa-raid-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    
    if (hpRemaining <= 0) {
      $('raid-cleared').style.display = 'flex';
      if (!localStorage.getItem(weekId)) {
        localStorage.setItem(weekId, 'cleared');
        pyroxeneBalance += 100;
        localStorage.setItem('noa-pyroxene', pyroxeneBalance);
        celebrate(['#f43f5e', '#fb7299', '#ffd36b', '#ffffff']);
        showMomotalk("주간 총력전 보스를 무사히 토벌했습니다! 보상으로 청휘석 100개가 지급되었습니다.");
        renderPyroxene();
      }
    } else {
      $('raid-cleared').style.display = 'none';
    }
  }

	  function renderHistory(ratio) {
	    const records = recentRecords();
	    const metrics = weeklyMetrics(records);

	    if (metrics.streak >= 3) unlockBadge('streak_3');
	    if (metrics.streak >= 7) unlockBadge('streak_7');

	    $('phase').textContent = phaseFor(ratio);
	    $('streakTop').textContent = `연속 ${metrics.streak}일`;
	    $('todayRecord').textContent = `${state.steps.toLocaleString()}보`;
	    $('weekSteps').textContent = `${metrics.weekTotal.toLocaleString()}보`;
	    $('goalDays').textContent = `${metrics.goalDays}일`;
	    $('stamps').innerHTML = records.map(r => {
	      const weekday = weekdayLabel(r.date);
	      const todayClass = isSameDay(r.date, new Date()) ? ' today' : '';
	      const walkedClass = r.steps > 0 ? ' walked' : '';
	      const doneClass = r.steps >= r.goal ? ' done' : '';
	      const title = `${weekday} ${r.steps.toLocaleString()}보 · ${sourceSummary(r.sources, r.steps).replace('출처: ', '')}`;
	      return `<div class="daystamp${todayClass}${walkedClass}${doneClass}" title="${title}"><i></i><span>${weekday}</span></div>`;
	    }).join('');
	    
	    updateChart(records);
	    renderRaidBoss(metrics.weekTotal);
	    renderBriefing(records, ratio);
    
    const lifetime = getLifetimeSteps();
    const affection = getAffectionLevel(lifetime);
    $('rankBadge').textContent = `Lv. ${affection.level} ${affection.title}`;

    // 호감도 레벨 2 이상(1만보 달성) 시 메모리얼 로비(Ken Burns) 자동 가동
    if (affection.level >= 2) {
      document.body.classList.add('memorial-mode');
    } else {
      if (!document.body.classList.contains('hide-ui')) {
        document.body.classList.remove('memorial-mode');
      }
    }

    // 레벨업(친밀도) 연출
    if (affection.level > lastAffectionLevel) {
      lastAffectionLevel = affection.level;
      localStorage.setItem('noa-affection-level', affection.level);
      celebrate(['#a78bfa', '#c4b5fd', '#7dd3fc', '#ffffff']);
      showMomotalk(`친밀도 Lv.${affection.level} 달성 — "${affection.title}". 선생님과 함께한 기록이 쌓여가네요.`);
    } else if (affection.level !== lastAffectionLevel) {
      // 초기화/하향 시 동기화만
      lastAffectionLevel = affection.level;
      localStorage.setItem('noa-affection-level', affection.level);
    }
  }

  function render() {
    els.steps.textContent = state.steps.toLocaleString();
    const ratio = Math.min(state.steps / state.goal, 1);
    els.prog.style.strokeDashoffset = CIRC * (1 - ratio);
    // 목표 달성 시 링을 금색으로 + 글로우
    const complete = ratio >= 1;
    els.prog.setAttribute('stroke', complete ? 'url(#gGold)' : 'url(#g)');
    els.prog.style.filter = complete ? 'drop-shadow(0 0 8px rgba(255,211,107,0.65))' : '';
    els.ring && els.ring.classList.toggle('complete', complete);
    const remain = Math.max(state.goal - state.steps, 0);
    els.goaltxt.textContent = remain > 0
      ? `목표 ${state.goal.toLocaleString()}보까지 ${remain.toLocaleString()}보 남음`
      : `목표 ${state.goal.toLocaleString()}보 달성 완료!`;
      
    const height = +(localStorage.getItem('noa-user-height') || 170);
    const weight = +(localStorage.getItem('noa-user-weight') || 65);
    const stride = (height * 0.414) / 100; 
    const km = (state.steps * stride) / 1000;
    els.dist.textContent = km.toFixed(2);

    const hours = (state.steps * 0.7) / 3600;
    const kcal = 3.5 * weight * hours;
    els.kcal.textContent = Math.round(kcal);
    els.pct.textContent = Math.round(ratio * 100) + '%';
    els.todayRecord.textContent = `${state.steps.toLocaleString()}보`;
    els.phase.textContent = phaseFor(ratio);

    for (let i = milestones.length - 1; i >= 0; i--) {
      if (ratio >= milestones[i].p && i > shownMile) {
        say(milestones[i].t);
        shownMile = i;
        break;
      }
    }
  }

		  function addSteps(n, source = 'sensor') {
	        const nowKey = todayKey();
	        if (state.currentDateKey && state.currentDateKey !== nowKey) {
	          // 자정(Midnight) 지남 -> 초기화 처리 및 어제 누적치를 lifetime-base에 안전하게 더해 O(1) 성능 유지
	          const baseVal = +(localStorage.getItem('noa-manbogi-lifetime-base') || 0);
	          localStorage.setItem('noa-manbogi-lifetime-base', baseVal + state.steps);
	          
	          state.steps = 0;
	          state.goalReachedToday = false;
	          state.easterEggShown = false;
	          state.currentDateKey = nowKey;
	          state.sources = makeEmptySources();
	          state.lastSource = '';
	          shownMile = -1;
	          cachedBaseLifetimeSteps = null; // 누적 걸음수 갱신
	          renderHistory(0);
	        }

        const milestoneBefore = shownMile;
		    const prev2k = Math.floor(state.steps / 2000);
		    const add = Math.max(0, Math.round(+n || 0));
		    state.steps += add;
		    markSource(source, add);
		    const curr2k = Math.floor(state.steps / 2000);
	    
	    render();
        if (shownMile === milestoneBefore && (n > 1 || state.steps % 100 === 0)) {
          $('msg').textContent = `오늘 ${state.steps.toLocaleString()}보까지 기록해 뒀어요.`;
        }

        // --- 랜덤 조우 이벤트 (2,000보 구간마다 약 30% 확률) ---
        if (curr2k > prev2k && curr2k > 0) {
          if (Math.random() < 0.3) {
            const events = [
              () => showMomotalk("유우카: 선생님! 산책도 좋지만 밀린 영수증 처리도 잊으시면 안 돼요!"),
              () => {
                 showMomotalk("코유키: 아하하! 선생님의 청휘석은 제가 잘 쓰겠습니다~!");
                 setTimeout(() => showMomotalk("노아: 코유키 쨩? 선생님의 물건에 손을 대면 곤란한데요. (코유키를 제압해 청휘석을 지켜냈습니다)"), 6000);
              },
              () => showMomotalk("아리스: 빠밤! 아리스, 산책 퀘스트를 수락했습니다! 경험치가 상승합니다!"),
              () => showMomotalk("히나: ...선생님. 걷는 건 좋지만 무리하지는 마. 쉴 땐 쉬어야 하니까.")
            ];
            pick(events)();
          }
        }

    if (state.steps >= 10000) unlockBadge('first_10k');
    const h = new Date().getHours();
    if ((h === 0 || h === 1) && state.steps >= 1000) unlockBadge('night_owl');
    
    if (state.steps >= state.goal && !state.goalReachedToday) {
      state.goalReachedToday = true;
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#a78bfa', '#7dd3fc', '#ffd36b', '#7ff0b2'],
          zIndex: 9999
        });
      }
    }

    if (state.steps >= 4130 && !state.easterEggShown) {
      state.easterEggShown = true;
      if (state.steps === 4130) {
        setTimeout(() => showMomotalk("비밀 기록 해금! 4월 13일, 오늘은 제 생일이네요. 4,130보를 정확히 달성해주시다니... 선생님의 섬세한 기록, 잊지 않을게요!"), 500);
      }
    }

	    save();
        refreshHistorySoon();
	  }

  // ---- step detection (공유 코어의 감지기 사용) ----
  const stepDetector = C.createStepDetector(() => { addSteps(1, 'sensor'); pulse(); });
  const onMotion = e => stepDetector.handle(e);

  let pulseT;
  function pulse() {
    els.steps.style.transform = 'scale(1.06)';
    clearTimeout(pulseT);
    pulseT = setTimeout(() => els.steps.style.transform = 'scale(1)', 120);
    // 진동 피드백 (손맛)
    if (navigator.vibrate) navigator.vibrate([10]);
  }

	  function setSensor(on, txt) {
	    $('dot').classList.toggle('on', on);
	    $('sensorTxt').textContent = txt;
	    updateSetupChecklist();
	  }

	  // HealthKit/백그라운드/생명주기는 공유 코어(NoaCore)에 위임. 풀버전 전용 후처리만 여기서.
	  let healthSyncEnabled = localStorage.getItem('noa-health-sync-enabled') === '1';
	  function syncHealthKit() {
	    return C.syncHealthKit({
	      getSteps: () => state.steps,
	      setSteps: n => {
	        const delta = Math.max(0, Math.round(+n || 0) - state.steps);
	        state.steps = Math.max(state.steps, Math.round(+n || 0));
	        markSource('health', delta);
	      },
	      onSynced: n => {
	        render();
	        save();
	        $('msg').textContent = `건강 앱에서 ${n.toLocaleString()}보를 동기화했어요.`;
	        refreshHistorySoon();
	      }
	    });
	  }
	  function maybeSyncHealthKit() {
	    if (!healthSyncEnabled) return;
	    return syncHealthKit();
	  }
	  function initBackgroundTasks() { return C.initBackgroundTasks(maybeSyncHealthKit); }
	  function setupAppLifecycle() { return C.setupAppLifecycle(maybeSyncHealthKit); }

  let audioUnlocked = false;
  async function start() {
    if (!audioUnlocked) {
      // iOS Audio Unlock: 무음 오디오 재생하여 브라우저 사운드 정책 해제
      const emptyAudio = new Audio("data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
      emptyAudio.play().catch(e => {});
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        speechSynthesis.speak(u);
      }
      audioUnlocked = true;
    }
    // iOS 13+ permission
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') { setSensor(false, '센서 권한 거부됨'); return; }
      } catch (err) { setSensor(false, '권한 요청 실패 (HTTPS 필요)'); return; }
    }
    if (typeof DeviceMotionEvent === 'undefined') {
      setSensor(false, '이 기기/브라우저는 동작 센서 미지원');
      return;
    }
    window.addEventListener('devicemotion', onMotion);
    state.running = true;
    setSensor(true, '측정 중 - 휴대폰을 들고 걸어보세요');
    $('toggle').textContent = '측정 정지';
    $('toggle').classList.add('stop');
	    if (shownMile < 0) say(pickLine(noaLines.start));
  }
  function stop() {
    window.removeEventListener('devicemotion', onMotion);
    state.running = false;
    setSensor(false, '측정 정지됨');
    $('toggle').textContent = '측정 시작';
    $('toggle').classList.remove('stop');
	    say(pickLine(noaLines.stop));
  }

  // ---- events ----
  $('toggle').onclick = () => state.running ? stop() : start();
  $('reset').onclick = () => {
	    if (confirm('오늘 걸음 수를 0으로 초기화할까요?')) {
	      state.steps = 0; shownMile = -1; state.goalReachedToday = false;
	      state.sources = makeEmptySources();
	      state.lastSource = '';
	      render(); renderHistory(0); save();
	      say(pickLine(noaLines.greeting));
    }
	  };
		  $('add').onclick = () => addSteps(10, 'test');
		  if ($('weather-btn')) {
		    $('weather-btn').onclick = fetchWeather;
		  }
		  if ($('setup-open')) $('setup-open').onclick = openSetupModal;
		  if ($('setup-close')) $('setup-close').onclick = closeSetupModal;
		  if ($('setup-done')) {
		    $('setup-done').onclick = () => {
		      localStorage.setItem('noa-setup-reviewed', '1');
		      closeSetupModal();
		      showMomotalk("시작 전 점검을 기록해 두었습니다. 이제 오늘의 산책 기록을 시작해볼까요?");
		    };
		  }
		  if ($('setup-motion-btn')) $('setup-motion-btn').onclick = requestMotionSetup;
		  if ($('setup-health-btn')) $('setup-health-btn').onclick = requestHealthSetup;
		  if ($('setup-weather-btn')) $('setup-weather-btn').onclick = fetchWeather;
		  if ($('setup-notification-btn')) $('setup-notification-btn').onclick = requestNotificationSetup;
			  $('voice').onclick = () => {
		    voiceOn = !voiceOn;
	    localStorage.setItem('noa-manbogi-voice', voiceOn ? '1' : '0');
	    updateVoiceBtn();
	    if (navigator.vibrate) navigator.vibrate([15]);
	    if (voiceOn) speak('음성을 켰어요, 선생님.');
	    else if ('speechSynthesis' in window) speechSynthesis.cancel();
  };
  $('goal').onchange = e => {
    state.goal = Math.max(100, +e.target.value || 10000);
    shownMile = milestoneIndexFor(Math.min(state.steps / state.goal, 1));
    render(); renderHistory(Math.min(state.steps / state.goal, 1)); save();
  };

	  // --- BGM ---
	  const BGM_FILE = 'voice/bgm.mp3';
	  let bgmOn = false;
	  let bgmAudio = null;
	  let bgmAvailable = false;
	  function updateBgmBtn() {
	    const btn = $('bgm-btn');
	    if (!btn) return;
	    if (!bgmAvailable) {
	      btn.disabled = true;
	      btn.classList.remove('on');
	      btn.textContent = 'BGM 준비중';
	      btn.title = 'voice/bgm.mp3를 추가하면 자동으로 활성화됩니다.';
	      return;
	    }
	    btn.disabled = false;
	    btn.title = '';
	    btn.textContent = bgmOn ? 'BGM 재생중' : 'BGM 꺼짐';
	    btn.classList.toggle('on', bgmOn);
	  }
	  async function initBgmAvailability() {
	    try {
	      // 로컬 파일 프로토콜 및 가상 서버(HEAD 미지원 가능성) 대응을 위해 GET으로 점검
	      const response = await fetch(BGM_FILE, { method: 'GET', cache: 'no-store' });
	      bgmAvailable = response.ok;
	    } catch (err) {
	      bgmAvailable = false;
	    }
	    updateBgmBtn();
	  }
	  $('bgm-btn').onclick = () => {
	    if (!bgmAvailable) {
	      showMomotalk("BGM 파일은 아직 준비 중이에요. voice/bgm.mp3를 추가하면 바로 재생할 수 있습니다.");
	      return;
	    }
	    bgmOn = !bgmOn;
	    const btn = $('bgm-btn');
	    if (navigator.vibrate) navigator.vibrate([15]);
	    
	    if (bgmOn) {
	      updateBgmBtn();
	      if (!bgmAudio) {
	        bgmAudio = new Audio(BGM_FILE);
	        bgmAudio.loop = true;
	      }
	      bgmAudio.play().catch(e => {
	        showMomotalk("BGM 파일(voice/bgm.mp3)을 찾을 수 없습니다.");
	        bgmAvailable = false;
	        bgmOn = false;
	        updateBgmBtn();
	      });
	    } else {
	      if (bgmAudio) bgmAudio.pause();
	      updateBgmBtn();
	    }
	  };

  // 모모톡 UI (Queue 시스템 적용)
  let momotalkQueue = [];
  let isMomotalkShowing = false;

  function showMomotalk(msg) {
    saveMomotalkHistory(msg);
    momotalkQueue.push(msg);
    processMomotalkQueue();
  }

  function processMomotalkQueue() {
    if (isMomotalkShowing || momotalkQueue.length === 0) return;
    
    isMomotalkShowing = true;
    const msg = momotalkQueue.shift();
    $('momotalk-msg').textContent = msg;
    
    const toast = $('momotalk-toast');
    toast.classList.remove('hidden');
    // 애니메이션을 위해 약간의 지연
    setTimeout(() => toast.classList.add('show'), 10);
    
    // 모모톡 효과음 (오프라인 안전한 Web Audio)
    playBeep(800, 80, 0.25);

    setTimeout(() => {
      closeMomotalk();
      setTimeout(() => {
        isMomotalkShowing = false;
        processMomotalkQueue();
      }, 500); // 닫히는 애니메이션 시간(400ms) 이후 다음 큐 처리
    }, 6000);
  }
  
  function closeMomotalk() {
    const toast = $('momotalk-toast');
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }
  $('momotalk-close').onclick = closeMomotalk;

  // 설정 모달
  function updateChatInputPlaceholder() {
    const chatInput = $('momotalk-chat-input');
    if (chatInput) {
      if (GEMINI_API_KEY) {
        chatInput.placeholder = "노아에게 메시지 보내기...";
        chatInput.disabled = false;
      } else {
        chatInput.placeholder = "설정에서 Gemini API Key를 등록해 주세요.";
        chatInput.disabled = true;
      }
    }
  }

  // --- UI 숨기기 및 메모리얼 터치 인터랙션 ---
  if ($('hide-ui-btn')) {
    $('hide-ui-btn').onclick = () => {
      document.body.classList.add('hide-ui');
      document.body.classList.add('memorial-mode');
      if (navigator.vibrate) navigator.vibrate([15]);
      say(pickLine(noaLines.memorial));
    };
  }

  if ($('hide-ui-overlay')) {
    $('hide-ui-overlay').onclick = () => {
      document.body.classList.remove('hide-ui');
      const lifetime = getLifetimeSteps();
      const affection = getAffectionLevel(lifetime);
      if (affection.level < 2) {
        document.body.classList.remove('memorial-mode');
      }
      if (navigator.vibrate) navigator.vibrate([15]);
    };
  }

  $('settings-btn').onclick = () => {
    $('user-height').value = localStorage.getItem('noa-user-height') || 170;
    $('user-weight').value = localStorage.getItem('noa-user-weight') || 65;
    $('gemini-key').value = localStorage.getItem('noa-gemini-key') || '';
    $('elevenlabs-key').value = localStorage.getItem('noa-elevenlabs-key') || '';
    $('elevenlabs-voice').value = localStorage.getItem('noa-elevenlabs-voice') || '';
    $('settings-modal').classList.remove('hidden');
  };
  $('settings-close').onclick = () => {
    const h = $('user-height').value;
    const w = $('user-weight').value;
    const gKey = $('gemini-key').value.trim();
    const key = $('elevenlabs-key').value.trim();
    const voice = $('elevenlabs-voice').value.trim();
    
    if (h) localStorage.setItem('noa-user-height', h);
    if (w) localStorage.setItem('noa-user-weight', w);
    
    localStorage.setItem('noa-gemini-key', gKey);
    GEMINI_API_KEY = gKey;
    localStorage.setItem('noa-elevenlabs-key', key);
    ELEVENLABS_API_KEY = key;
    localStorage.setItem('noa-elevenlabs-voice', voice);
    ELEVENLABS_VOICE_ID = voice;
    
    $('settings-modal').classList.add('hidden');
    render(); // 바뀐 설정으로 다시 계산
    updateChatInputPlaceholder();
  };

  // --- 인게임 보상 시스템 (청휘석) ---
  let pyroxeneBalance = +(localStorage.getItem('noa-pyroxene')) || 0;
  let pyroxeneLifetime = +(localStorage.getItem('noa-pyroxene-lifetime')) || 0;
  
  function renderPyroxene() {
    const el = $('pyroxene-count');
    if (el) el.textContent = pyroxeneBalance;
  }
  
  function checkPyroxenes() {
    const lifetime = getLifetimeSteps();
    const newLifetime = Math.floor(lifetime / 1000); // 1,000보당 1개
    if (newLifetime > pyroxeneLifetime) {
      const earned = newLifetime - pyroxeneLifetime;
      pyroxeneBalance += earned;
      pyroxeneLifetime = newLifetime;
      localStorage.setItem('noa-pyroxene', pyroxeneBalance);
      localStorage.setItem('noa-pyroxene-lifetime', pyroxeneLifetime);
      showMomotalk(`청휘석 ${earned}개를 발견했습니다! (보유: ${pyroxeneBalance}개)`);
      renderPyroxene();
    }
  }

  // --- 상점 (Shop) 시스템 ---
  const SHOP_ITEMS = [
    { id: 'theme_default', type: 'theme', name: '배경: 오리지널 (기본)', cost: 0, unlocked: true },
    { id: 'theme_1', type: 'theme', name: '배경: 프라이빗 노아', cost: 10, unlocked: false },
    { id: 'theme_2', type: 'theme', name: '배경: 휴식 시간', cost: 15, unlocked: false },
    { id: 'theme_3', type: 'theme', name: '배경: 샬레의 노아', cost: 20, unlocked: false },
    { id: 'voice_secret', type: 'voice', name: '특별 보이스 해금', cost: 50, unlocked: false },
  ];
  function getPurchasedItems() {
    try { return JSON.parse(localStorage.getItem('noa-purchased')) || []; }
    catch(e) { return []; }
  }
  function purchaseItem(id, cost) {
    if (pyroxeneBalance >= cost) {
      pyroxeneBalance -= cost;
      localStorage.setItem('noa-pyroxene', pyroxeneBalance);
      const purchased = getPurchasedItems();
      purchased.push(id);
      localStorage.setItem('noa-purchased', JSON.stringify(purchased));
      renderPyroxene();
      renderShop();
      showMomotalk("구매가 완료되었습니다, 선생님!");
    } else {
      showMomotalk("청휘석이 부족합니다.");
    }
  }
  function equipTheme(id) {
    if (navigator.vibrate) navigator.vibrate([15]);
    if (id === 'theme_default') {
      localStorage.removeItem('noa-equipped-theme');
    } else {
      localStorage.setItem('noa-equipped-theme', id);
    }
    applyPurchasedItems();
    renderShop();
    showMomotalk("배경화면이 변경되었습니다!");
  }
  function applyPurchasedItems() {
    document.body.classList.remove('theme-1', 'theme-2', 'theme-3');
    const equipped = localStorage.getItem('noa-equipped-theme');
    if (equipped) {
      document.body.classList.add(equipped.replace('_', '-'));
    }
  }
  
  function renderShop() {
    const purchased = getPurchasedItems();
    const list = $('shop-list');
    if (!list) return;
    list.innerHTML = SHOP_ITEMS.map(item => {
      const isPurchased = item.cost === 0 || purchased.includes(item.id);
      const equipped = localStorage.getItem('noa-equipped-theme');
      const isEquipped = (equipped === item.id) || (item.id === 'theme_default' && !equipped);
      let btnHtml = '';
      if (!isPurchased) {
        btnHtml = `<button data-action="buy" data-id="${item.id}" data-cost="${item.cost}" style="background:#7dd3fc; color:#0f172a; padding:6px 12px; font-size:12px; font-weight:bold; border-radius:8px; border:none; cursor:pointer;">${item.cost} 구매</button>`;
      } else if (item.type === 'theme') {
        if (isEquipped) {
          btnHtml = `<button disabled style="background:rgba(255,255,255,0.1); color:var(--good); padding:6px 12px; font-size:12px; border-radius:8px; border:1px solid var(--good);">적용됨</button>`;
        } else {
          btnHtml = `<button data-action="equip" data-id="${item.id}" style="background:rgba(255,255,255,0.1); color:#fff; padding:6px 12px; font-size:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.4); cursor:pointer;">적용하기</button>`;
        }
      } else {
        btnHtml = `<button disabled style="background:rgba(255,255,255,0.1); color:var(--muted); padding:6px 12px; font-size:12px; border-radius:8px; border:none;">보유중</button>`;
      }
      
      return `
        <div class="shop-item">
          <div>
            <div class="shop-item-title">${item.name}</div>
          </div>
          <div>${btnHtml}</div>
        </div>
      `;
    }).join('');
  }

  // --- 개발자(DEV) 오버레이 모달 ---
  const devBtn = $('dev-btn');
  if (devBtn) {
    devBtn.onclick = (e) => {
      e.preventDefault();
      $('dev-modal').classList.remove('hidden');
    };
  }
  $('dev-close').onclick = () => $('dev-modal').classList.add('hidden');
  
  $('dev-add-10k').onclick = () => {
    addSteps(10000, 'dev');
    showMomotalk("개발자 권한으로 10,000보가 즉시 추가되었습니다.");
  };
  
  $('dev-add-pyroxene').onclick = () => {
    pyroxeneBalance += 1000;
    localStorage.setItem('noa-pyroxene', pyroxeneBalance);
    renderPyroxene();
    showMomotalk("개발자 권한으로 1,000 청휘석이 무한 복사(?) 되었습니다.");
  };
  
  $('dev-force-encounter').onclick = () => {
    const events = [
      () => showMomotalk("유우카: 선생님! 산책도 좋지만 밀린 영수증 처리도 잊으시면 안 돼요!"),
      () => {
         showMomotalk("코유키: 아하하! 선생님의 청휘석은 제가 잘 쓰겠습니다~!");
         setTimeout(() => showMomotalk("노아: 코유키 쨩? 선생님의 물건에 손을 대면 곤란한데요. (코유키를 제압해 청휘석을 지켜냈습니다)"), 6000);
      },
      () => showMomotalk("아리스: 빠밤! 아리스, 산책 퀘스트를 수락했습니다! 경험치가 상승합니다!"),
      () => showMomotalk("히나: ...선생님. 걷는 건 좋지만 무리하지는 마. 쉴 땐 쉬어야 하니까.")
    ];
    $('dev-modal').classList.add('hidden');
    pick(events)();
  };
  
  $('dev-reset-shop').onclick = () => {
    localStorage.removeItem('noa-purchased');
    localStorage.removeItem('noa-equipped-theme');
    applyPurchasedItems();
    renderShop();
    showMomotalk("상점 환불 완료. 구매 내역이 초기화되었습니다.");
  };
  
  $('dev-reset-raid').onclick = () => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    const weekId = `noa-raid-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    localStorage.removeItem(weekId);
    renderHistory(Math.min(state.steps / state.goal, 1));
    showMomotalk("총력전 보스가 부활했습니다. 다시 공략해 보세요!");
  };
  
  $('dev-factory-reset').onclick = () => {
    if (confirm("정말로 모든 걸음 수, 청휘석, 상점 내역을 지우고 앱을 초기화하시겠습니까?")) {
      localStorage.clear();
      location.reload();
    }
  };
  
  if ($('pyroxene-btn')) {
    $('pyroxene-btn').onclick = () => {
      renderShop();
      $('shop-modal').classList.remove('hidden');
    };
  }
  if ($('shop-close')) {
    $('shop-close').onclick = () => $('shop-modal').classList.add('hidden');
  }
  // 상점 버튼 이벤트 위임 (전역 노출 없이 IIFE 안에서 처리)
  if ($('shop-list')) {
    $('shop-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'buy') purchaseItem(btn.dataset.id, +btn.dataset.cost);
      else if (btn.dataset.action === 'equip') equipTheme(btn.dataset.id);
    });
  }

  // --- 업적(Badges) 시스템 ---
  const BADGE_DEFS = [
    { id: 'first_10k', icon: '10K', name: '첫 1만보', desc: '루틴의 시작! 하루 10,000보 달성' },
    { id: 'streak_3', icon: '3 DAYS', name: '작심삼일 극복', desc: '3일 연속 목표 걸음 수 달성' },
    { id: 'streak_7', icon: '7 DAYS', name: '기록의 달인', desc: '7일 연속 목표 걸음 수 달성' },
    { id: 'night_owl', icon: 'NIGHT', name: '철야의 서기', desc: '자정~새벽 2시 사이에 1,000보 이상 기록' },
    { id: 'noa_bday', icon: 'SECRET', name: '우시오 노아의 생일', desc: '하루 4,130보 정확히 달성 후 기록' },
  ];
  function getUnlockedBadges() {
    try { return JSON.parse(localStorage.getItem('noa-badges')) || []; }
    catch(e) { return []; }
  }
  function unlockBadge(id) {
    const unlocked = getUnlockedBadges();
    if (!unlocked.includes(id)) {
      unlocked.push(id);
      localStorage.setItem('noa-badges', JSON.stringify(unlocked));
      const b = BADGE_DEFS.find(x => x.id === id);
      if (b) showMomotalk(`[업적 달성] ${b.name} : ${b.desc}`);
    }
  }

  // --- 모모톡 히스토리 ---
  function saveMomotalkHistory(msg) {
    try {
      const hist = JSON.parse(localStorage.getItem('noa-momotalk-hist')) || [];
      hist.push({ time: Date.now(), msg });
      if (hist.length > 50) hist.shift(); // 최대 50개 유지
      localStorage.setItem('noa-momotalk-hist', JSON.stringify(hist));
    } catch(e) {}
  }

  // --- 모모톡 메신저 & 히스토리 통합 로직 ---
  let chatHistory = [];
  try {
    chatHistory = JSON.parse(localStorage.getItem('noa-momotalk-chat')) || [
      { sender: 'model', time: Date.now(), msg: "선생님, 오늘도 기록 잘 부탁드려요. 무슨 이야기든 들려주세요!" }
    ];
  } catch(e) {
    chatHistory = [
      { sender: 'model', time: Date.now(), msg: "선생님, 오늘도 기록 잘 부탁드려요. 무슨 이야기든 들려주세요!" }
    ];
  }

  function saveChatHistory() {
    try {
      // 대화 기록 무제한 누적으로 인한 localStorage QuotaExceededError 방지
      if (chatHistory.length > 100) {
        chatHistory = chatHistory.slice(-100);
      }
      localStorage.setItem('noa-momotalk-chat', JSON.stringify(chatHistory));
    } catch(e) {}
  }

  function formatTime(timestamp) {
    const d = new Date(timestamp);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

	  function renderChat() {
	    const list = $('momotalk-chat-messages');
	    if (!list) return;
	    list.textContent = '';
	    chatHistory.forEach(c => {
	      const isSelf = c.sender === 'self';
	      const row = document.createElement('div');
	      row.className = isSelf ? 'chat-bubble-row self' : 'chat-bubble-row';

	      if (!isSelf) {
	        const avatar = document.createElement('img');
	        avatar.src = 'icon-192.png';
	        avatar.alt = 'Noa';
	        avatar.className = 'chat-avatar';
	        row.appendChild(avatar);
	      }

	      const container = document.createElement('div');
	      container.className = 'chat-msg-container';
	      if (!isSelf) {
	        const name = document.createElement('div');
	        name.className = 'chat-sender-name';
	        name.textContent = '노아';
	        container.appendChild(name);
	      }

	      const wrapper = document.createElement('div');
	      wrapper.className = 'chat-bubble-wrapper';

	      const bubble = document.createElement('div');
	      bubble.className = 'chat-bubble';
	      bubble.textContent = c.msg || '';

	      const time = document.createElement('div');
	      time.className = 'chat-time';
	      time.textContent = formatTime(c.time);

	      wrapper.appendChild(bubble);
	      wrapper.appendChild(time);
	      container.appendChild(wrapper);
	      row.appendChild(container);
	      list.appendChild(row);
	    });
	    list.scrollTop = list.scrollHeight;
	  }

  function renderLogs() {
    const list = $('momotalk-log-view');
    if (!list) return;
	    let hist = [];
	    try { hist = JSON.parse(localStorage.getItem('noa-momotalk-hist')) || []; } catch(e) {}
	    list.textContent = '';
	    if (hist.length === 0) {
	      const empty = document.createElement('div');
	      empty.className = 'history-empty';
	      empty.textContent = '아직 기록된 대화가 없습니다.';
	      list.appendChild(empty);
	    } else {
	      hist.slice().reverse().forEach(h => {
	        const d = new Date(h.time);
	        const dateStr = `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	        const item = document.createElement('div');
	        item.className = 'history-item';
	        const time = document.createElement('div');
	        time.className = 'history-item-time';
	        time.textContent = dateStr;
	        const msg = document.createElement('div');
	        msg.className = 'history-item-msg';
	        msg.textContent = h.msg || '';
	        item.appendChild(time);
	        item.appendChild(msg);
	        list.appendChild(item);
	      });
	    }
	  }

  function getSystemPrompt() {
    const height = +(localStorage.getItem('noa-user-height') || 170);
    const weight = +(localStorage.getItem('noa-user-weight') || 65);
    const stride = (height * 0.414) / 100;
    const km = (state.steps * stride) / 1000;
    const hours = (state.steps * 0.7) / 3600;
    const kcal = Math.round(3.5 * weight * hours);
    const ratio = Math.min(state.steps / state.goal, 1);
    const pct = Math.round(ratio * 100);
	    const isStamped = localStorage.getItem('noa-sensei-stamped') === '1';
	    
	    const records = recentRecords();
	    const metrics = weeklyMetrics(records);
	    
	    return `당신은 블루 아카이브(Blue Archive)의 캐릭터 '우시오 노아(Ushio Noa)'입니다.
선생님(사용자)과 모모톡으로 대화하고 있습니다. 아래 규칙을 철저히 지켜서 한국어로 답변해주세요.

[캐릭터 정보]
- 소속: 밀레니엄 사이언스 스쿨 세미나 서기.
- 성격: 차분하고 지적이며 기억력이 뛰어납니다. 선생님에게 존댓말을 쓰며 정중하지만 살짝 장난기 섞인 상냥한 어조를 씁니다.
- 말투 특징: '~이랍니다', '~답니다', '선생님'이라는 호칭을 사용하며, 부드럽고 여유 있는 여고생 비서 말투를 유지합니다.

[현재 선생님의 상태 (메모리)]
- 오늘 걸음 수: ${state.steps.toLocaleString()}보 (목표: ${state.goal.toLocaleString()}보, 달성률: ${pct}%)
- 이동 거리: ${km.toFixed(2)}km, 소모 칼로리: ${kcal}kcal
- 기록 출처: ${sourceSummary(state.sources, state.steps).replace('출처: ', '')}
- 이번 주 누적 걸음 수: ${metrics.weekTotal.toLocaleString()}보
- 이번 주 최고 기록: ${weekdayLabel(metrics.best.date)} ${metrics.best.steps.toLocaleString()}보
- 연속 기록: ${metrics.streak}일, 목표 달성일: ${metrics.goalDays}일
- 오늘 리포트 결재 상태: ${isStamped ? '선생님 결재 완료 (도장 찍음)' : '미결재 상태'}
- 현재 날씨 상태: ${weatherState || '맑음'}

위 상태 정보(오늘 걸은 거리, 보스 진행 상황, 결재 여부 등)를 대화 맥락에 자연스럽게 녹여서 말해주세요. 예를 들어 선생님이 오늘 많이 걸었는지 물어보면 오늘 걸음 수와 달성률을 알려주며 칭찬해주고, 리포트 결재를 안 했다면 결재해달라고 정중히 장난스럽게 재촉해주세요. 답변은 2~3문장 정도로 모모톡 메시지처럼 간결하게 끊어 작성해주세요.`;
  }

  async function callGemini() {
    if (!GEMINI_API_KEY) return "선생님, 설정에서 Gemini API Key를 등록하시면 저와 대화를 나눌 수 있답니다.";
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const recentHistory = chatHistory.slice(-12);
    const contents = [];
    recentHistory.forEach(h => {
      const role = h.sender === 'self' ? 'user' : 'model';
      // Gemini 400 Bad Request 에러 방지: 연속된 동일 Role의 말풍선들을 하나로 합침
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n' + (h.msg || '');
      } else {
        contents.push({
          role: role,
          parts: [{ text: h.msg || '' }]
        });
      }
    });
    
    const requestBody = {
      system_instruction: {
        parts: [{ text: getSystemPrompt() }]
      },
      contents: contents
    };
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini API Error Response:", errText);
        return "죄송해요, 선생님. 통신 도중 일시적인 네트워크 오류가 발생했답니다. 다시 말씀해 주시겠어요?";
      }
      
      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text.trim();
      } else {
        return "선생님의 말씀을 기록하는 데에 잠시 혼선이 생긴 모양이에요. 다시 한 번 말씀해 주세요.";
      }
    } catch (err) {
      console.error("Gemini fetch error:", err);
      return "선생님, 서버와의 연동에 문제가 발생한 모양이에요. 설정창의 API Key가 맞는지 다시 한 번 점검해 주시겠어요?";
    }
  }

  async function handleSendMessage() {
    const input = $('momotalk-chat-input');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    
    chatHistory.push({ sender: 'self', time: Date.now(), msg });
    saveChatHistory();
    input.value = '';
    renderChat();
    
    const list = $('momotalk-chat-messages');
    const typingId = 'typing-indicator';
    const typingRow = document.createElement('div');
    typingRow.id = typingId;
    typingRow.className = 'chat-bubble-row';

    const avatar = document.createElement('img');
    avatar.src = 'icon-192.png';
    avatar.alt = 'Noa';
    avatar.className = 'chat-avatar';
    typingRow.appendChild(avatar);

    const container = document.createElement('div');
    container.className = 'chat-msg-container';
    const name = document.createElement('div');
    name.className = 'chat-sender-name';
    name.textContent = '노아';
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-bubble-wrapper';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble typing-bubble';
    bubble.textContent = '노아가 입력 중입니다...';
    wrapper.appendChild(bubble);
    container.appendChild(name);
    container.appendChild(wrapper);
    typingRow.appendChild(container);
    list.appendChild(typingRow);
    list.scrollTop = list.scrollHeight;
    
    const reply = await callGemini();
    
    const indicator = $(typingId);
    if (indicator) indicator.remove();
    
    chatHistory.push({ sender: 'model', time: Date.now(), msg: reply });
    saveChatHistory();
    renderChat();
    
    speak(reply);
  }

  // 탭 클릭 이벤트
  $('tab-chat').onclick = () => {
    $('tab-chat').classList.add('active');
    $('tab-log').classList.remove('active');
    $('momotalk-chat-view').style.display = 'flex';
    $('momotalk-log-view').style.display = 'none';
    renderChat();
  };

  $('tab-log').onclick = () => {
    $('tab-chat').classList.remove('active');
    $('tab-log').classList.add('active');
    $('momotalk-chat-view').style.display = 'none';
    $('momotalk-log-view').style.display = 'flex';
    renderLogs();
  };

  // 모모톡 히스토리 모달 UI
  $('momotalk-btn').onclick = () => {
    $('tab-chat').click();
    updateChatInputPlaceholder();
    $('momotalk-history-modal').classList.remove('hidden');
    renderChat();
  };
  $('momotalk-history-close').onclick = () => $('momotalk-history-modal').classList.add('hidden');

  $('momotalk-chat-send').onclick = handleSendMessage;
  $('momotalk-chat-input').onkeydown = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // 업적 모달 UI
  $('achievements-btn').onclick = () => {
    const list = $('achievements-list');
    const unlocked = getUnlockedBadges();
    list.innerHTML = BADGE_DEFS.map(b => {
      const isUnl = unlocked.includes(b.id);
      const cssClass = isUnl ? 'badge-item unlocked' : 'badge-item locked';
      return `
        <div class="${cssClass}">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-name">${b.name}</div>
          <div class="badge-desc">${b.desc}</div>
        </div>
      `;
    }).join('');
    $('achievements-modal').classList.remove('hidden');
  };
  $('achievements-close').onclick = () => $('achievements-modal').classList.add('hidden');

	  // 푸시 알림 (Local Notifications)
	  let notificationsEnabled = localStorage.getItem('noa-notifications-enabled') === '1';
	  async function setupNotifications(requestPermission = false) {
	    if (window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.LocalNotifications) {
	      try {
	        const LN = window.Capacitor.Plugins.LocalNotifications;
	        const perm = requestPermission
	          ? await LN.requestPermissions()
	          : (typeof LN.checkPermissions === 'function' ? await LN.checkPermissions() : { display: 'prompt' });
	        if (perm.display !== 'granted') return;
	        notificationsEnabled = true;
	        localStorage.setItem('noa-notifications-enabled', '1');
	        
	        await LN.cancel({ notifications: [{ id: 1 }, { id: 2 }] });
        
        await LN.schedule({
          notifications: [
            {
              title: "모모톡 - 우시오 노아",
              body: "선생님, 좋은 아침이에요. 오늘 기록을 시작할까요?",
              id: 1,
              schedule: { on: { hour: 8, minute: 0 } },
              smallIcon: "ic_stat_name"
            },
            {
              title: "모모톡 - 우시오 노아",
              body: "선생님, 오늘 하루도 수고 많으셨어요. 기록을 한 번 확인해보실래요?",
              id: 2,
              schedule: { on: { hour: 20, minute: 0 } },
              smallIcon: "ic_stat_name"
            }
          ]
        });
      } catch (err) {
	        console.error("푸시 알림 설정 실패:", err);
	      }
	    }
	  }

	  // --- 첫 실행 온보딩 / 권한 점검 ---
	  function setSetupState(key, text, done = false) {
	    const compact = $(`setup-${key}`);
	    const modal = $(`setup-${key}-state`);
	    const action = $(`setup-${key}-btn`);
	    if (compact) compact.textContent = text;
	    if (modal) modal.textContent = text.replace(/^[^:]+:\s*/, '');
	    if (action) action.classList.toggle('done', done);
	  }
	  function updateSetupChecklist() {
	    const motionReady = state.running;
	    const motionSupported = typeof DeviceMotionEvent !== 'undefined';
	    setSetupState('motion',
	      motionReady ? '동작 센서: 측정 중' : motionSupported ? '동작 센서: 측정 시작 시 확인' : '동작 센서: 미지원',
	      motionReady
	    );
	    setSetupState('health',
	      healthSyncEnabled ? 'HealthKit: 연동 켜짐' : 'HealthKit: 선택 연동',
	      healthSyncEnabled
	    );
	    setSetupState('weather',
	      weatherState ? `날씨: ${$('weather-icon')?.textContent || '확인됨'} ${$('weather-temp')?.textContent || ''}` : '날씨: 선택 확인',
	      Boolean(weatherState)
	    );
	    setSetupState('notification',
	      notificationsEnabled ? '알림: 예약됨' : '알림: 선택 예약',
	      notificationsEnabled
	    );
	  }
	  function openSetupModal() {
	    updateSetupChecklist();
	    const modal = $('setup-modal');
	    if (modal) modal.classList.remove('hidden');
	  }
	  function closeSetupModal() {
	    const modal = $('setup-modal');
	    if (modal) modal.classList.add('hidden');
	  }
	  async function requestMotionSetup() {
	    if (typeof DeviceMotionEvent === 'undefined') {
	      setSetupState('motion', '동작 센서: 이 브라우저는 미지원');
	      return;
	    }
	    if (typeof DeviceMotionEvent.requestPermission === 'function') {
	      try {
	        const res = await DeviceMotionEvent.requestPermission();
	        setSetupState('motion', res === 'granted' ? '동작 센서: 허용됨' : '동작 센서: 권한 필요', res === 'granted');
	        return;
	      } catch (err) {
	        setSetupState('motion', '동작 센서: HTTPS 필요');
	        return;
	      }
	    }
	    setSetupState('motion', '동작 센서: 측정 가능', true);
	  }
	  async function requestHealthSetup() {
	    if (!(window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.Health)) {
	      setSetupState('health', 'HealthKit: 앱 빌드에서 사용 가능');
	      return;
	    }
	    healthSyncEnabled = true;
	    localStorage.setItem('noa-health-sync-enabled', '1');
	    await syncHealthKit();
	    updateSetupChecklist();
	  }
	  async function requestNotificationSetup() {
	    if (!(window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.LocalNotifications)) {
	      setSetupState('notification', '알림: 앱 빌드에서 사용 가능');
	      return;
	    }
	    await setupNotifications(true);
	    updateSetupChecklist();
	  }

  // --- 리포트 공유 시스템 ---
  if ($('share-report')) {
	    $('share-report').onclick = async () => {
	      if (typeof html2canvas === 'undefined') {
	        showMomotalk("결재 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
	        return;
	      }
	      showMomotalk("결재 서류를 작성 중입니다... 잠시만 기다려주세요!");
	      const panel = document.querySelector('.panel');
	      const controls = document.querySelectorAll('.controls, #momotalk-btn, #achievements-btn, #settings-btn, #pyroxene-btn, #hide-ui-btn');
	      const oldBackground = panel ? panel.style.background : '';

	      try {
	        if (!panel) throw new Error('Report panel not found');
	        // HTML2Canvas backdrop-filter 렌더링 오류 방지를 위한 임시 단색 배경
	        panel.style.background = '#1a2144';
	        
	        // 캡처 시 불필요한 컨트롤 버튼 숨김
	        controls.forEach(c => {
	            if(c) {
	                c.dataset.oldDisplay = c.style.display;
                c.style.display = 'none';
            }
        });
        
        // Wait for next frame so DOM updates
        await new Promise(r => setTimeout(r, 100));
        
        const canvas = await html2canvas(panel, {
          scale: 2,
          backgroundColor: '#12162f',
          logging: false,
          useCORS: true,
          allowTaint: true,
          border: 0
        });
	        const link = document.createElement('a');
	        link.download = `noa-schale-report-${todayKey()}.png`;
	        link.href = canvas.toDataURL('image/png');
        link.click();
        
        setTimeout(() => showMomotalk("주간 활동 리포트가 기기에 저장되었습니다!"), 500);
	      } catch (e) {
	        showMomotalk("리포트 작성에 실패했습니다.");
	        console.error(e);
	      } finally {
	        if (panel) panel.style.background = oldBackground;
	        controls.forEach(c => {
	          if (c) {
	            c.style.display = c.dataset.oldDisplay || '';
	            delete c.dataset.oldDisplay;
	          }
	        });
	      }
	    };
	  }

  // --- 결재 도장(직인) 상호작용 ---
  const senseiTd = $('stamp-sensei-td');
  if (senseiTd) {
    const stampEl = $('stamp-sensei');
    const isStamped = localStorage.getItem('noa-sensei-stamped') === '1';
    if (isStamped && stampEl) {
      stampEl.classList.remove('locked');
    }
    
    senseiTd.onclick = () => {
      if (stampEl && stampEl.classList.contains('locked')) {
        stampEl.classList.remove('locked');
        stampEl.classList.add('stamping');
        localStorage.setItem('noa-sensei-stamped', '1');
        
        // 햅틱 진동 피드백
        if (navigator.vibrate) navigator.vibrate([30, 50]);
        
        // 결재 도장 효과음 (오프라인 안전한 Web Audio)
        playBeep(600, 120, 0.4);
        
        showMomotalk("선생님, 보고서 결재가 완료되었습니다. 수고하셨습니다!");
        
        setTimeout(() => {
          stampEl.classList.remove('stamping');
        }, 500);
      }
    };
  }

  // init
	  $('date').textContent = new Date().toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' });
	  load();
	  shownMile = milestoneIndexFor(Math.min(state.steps / state.goal, 1));
	  maybeSyncHealthKit();
	  initBackgroundTasks();
	  setupAppLifecycle();
	  if (notificationsEnabled) setupNotifications(false);
	  renderPyroxene();
	  applyPurchasedItems();
	  renderHistory(Math.min(state.steps / state.goal, 1));
	  render();
	  updateVoiceBtn();
	  initBgmAvailability();
	  checkLocalVoicePack();
	  updateSetupChecklist();
	  $('msg').textContent = state.steps > 0
	    ? `오늘 ${state.steps.toLocaleString()}보까지 기록해 뒀어요.`
	    : pickLine(noaLines.greeting);
	  if (!localStorage.getItem('noa-setup-reviewed')) {
	    setTimeout(openSetupModal, 700);
	  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
