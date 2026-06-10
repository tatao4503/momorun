(() => {
  const $ = id => document.getElementById(id);
  const CIRC = 2 * Math.PI * 106; // ≈ 666

	  const state = {
	    steps: 0,
	    goal: 10000,
	    running: false,
	    lastStepTime: 0,
	    goalReachedToday: false,
	    easterEggShown: false,
	    currentDateKey: null
	  };
	
	  // ---- daily persistence ----
  const STORAGE_PREFIX = 'noa-manbogi-';
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const legacyDateKey = d => `${STORAGE_PREFIX}${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
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
      };
    } catch (_) {
      return null;
    }
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
      let base = 0;
      const todayStr = dateKey(new Date());
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(STORAGE_PREFIX) && k !== todayStr && k !== 'noa-manbogi-goal' && k !== 'noa-manbogi-voice') {
          const rec = parseRecord(k);
          if (rec) base += rec.steps;
        }
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
    const ctx = document.getElementById('weekChart').getContext('2d');
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
  function saveNow() {
    clearTimeout(saveTimer);
    localStorage.setItem(todayKey(), JSON.stringify({ steps: state.steps, goal: state.goal }));
    localStorage.setItem('noa-manbogi-goal', state.goal);
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
	    if (state.steps >= state.goal) state.goalReachedToday = true;
	    if (state.steps >= 4130) state.easterEggShown = true;
	    $('goal').value = state.goal;
	    // 첫 로드 시점엔 현재 레벨로 동기화(잘못된 레벨업 연출 방지)
	    lastAffectionLevel = getAffectionLevel(getLifetimeSteps()).level;
	    localStorage.setItem('noa-affection-level', lastAffectionLevel);
        fetchWeather();
	  }

  // --- 실시간 날씨 연동 (Open-Meteo) ---
  let weatherState = null;
  async function fetchWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const code = data.current_weather.weathercode;
        const temp = data.current_weather.temperature;
        
        let wIcon = '☀️'; let wType = 'clear';
        if (code >= 1 && code <= 3) { wIcon = '☁️'; wType = 'cloudy'; }
        else if (code >= 51 && code <= 67) { wIcon = '☔'; wType = 'rain'; }
        else if (code >= 71 && code <= 77) { wIcon = '❄️'; wType = 'snow'; }
        
        weatherState = wType;
        $('weather-icon').textContent = wIcon;
        $('weather-temp').textContent = Math.round(temp) + '°C';
        $('weather-box').style.display = 'flex';
        
        // 날씨에 따른 특수 모모톡 대사 (처음에만)
        if (shownMile < 0 && state.steps < 100) {
          if (wType === 'rain') setTimeout(() => showMomotalk("비가 오네요, 선생님. 우산은 꼭 챙기셨죠? 미끄러지지 않게 조심하세요."), 1000);
          else if (wType === 'snow') setTimeout(() => showMomotalk("눈이 내리고 있어요! 샬레 밖이 새하얗네요. 빙판길 조심해서 출발할까요?"), 1000);
        }
      } catch(e) { console.error('Weather fetch error', e); }
    }, () => {});
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
  };
  const milestones = [
    { p: 0.25, t: "좋은 출발이에요, 선생님. 순조롭게 적히고 있어요." },
    { p: 0.50, t: "절반 지점이에요. 기록은 정확하게 남기고 있어요." },
    { p: 0.75, t: "조금만 더예요. 끝까지 함께 기록할게요." },
    { p: 1.00, t: "수고하셨습니다, 선생님." },
  ];
	  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
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

  // --- 음성 ---
  // 진짜 노아 보이스 클립을 쓰려면 voice/ 폴더에 mp3를 넣고 아래 맵에 "대사": "voice/파일.mp3" 추가.
  // 매핑이 없으면 브라우저 음성합성(TTS)으로 자동 대체.
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
  let ELEVENLABS_API_KEY = localStorage.getItem('noa-elevenlabs-key') || '';
  let ELEVENLABS_VOICE_ID = localStorage.getItem('noa-elevenlabs-voice') || '';
  function ttsSpeak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1.0; u.pitch = 1.15;
    speechSynthesis.speak(u);
  }
  async function speak(text) {
    if (!voiceOn || !text) return;
    
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
    if (clip) {
      const a = new Audio(clip);
      a.play().catch(() => ttsSpeak(text));
    } else {
      ttsSpeak(text);
    }
  }
  function updateVoiceBtn() {
    const b = $('voice');
    b.textContent = voiceOn ? '노아 음성: ON' : '노아 음성: OFF';
    b.classList.toggle('on', voiceOn);
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
  
  // --- DOM Caching ---
  const els = {
    steps: $('steps'),
    prog: $('prog'),
    goaltxt: $('goaltxt'),
    dist: $('dist'),
    kcal: $('kcal'),
    pct: $('pct'),
    todayRecord: $('todayRecord'),
    phase: $('phase')
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
    const weekTotal = records.reduce((sum, r) => sum + r.steps, 0);
    const goalDays = records.filter(r => r.steps >= r.goal).length;
    let streak = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].steps <= 0) break;
      streak++;
    }

    if (streak >= 3) unlockBadge('streak_3');
    if (streak >= 7) unlockBadge('streak_7');

    $('phase').textContent = phaseFor(ratio);
    $('streakTop').textContent = `연속 ${streak}일`;
    $('todayRecord').textContent = `${state.steps.toLocaleString()}보`;
    $('weekSteps').textContent = `${weekTotal.toLocaleString()}보`;
    $('goalDays').textContent = `${goalDays}일`;
    $('stamps').innerHTML = records.map(r => {
      const weekday = r.date.toLocaleDateString('ko-KR', { weekday: 'short' });
      const todayClass = isSameDay(r.date, new Date()) ? ' today' : '';
      const walkedClass = r.steps > 0 ? ' walked' : '';
      const doneClass = r.steps >= r.goal ? ' done' : '';
      const title = `${weekday} ${r.steps.toLocaleString()}보`;
      return `<div class="stamp${todayClass}${walkedClass}${doneClass}" title="${title}"><i></i><span>${weekday}</span></div>`;
    }).join('');
    
    updateChart(records);
    renderRaidBoss(weekTotal);
    
    const lifetime = getLifetimeSteps();
    const affection = getAffectionLevel(lifetime);
    $('rankBadge').textContent = `Lv. ${affection.level} ${affection.title}`;

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

	  function addSteps(n) {
        const nowKey = todayKey();
        if (state.currentDateKey && state.currentDateKey !== nowKey) {
          // 자정(Midnight) 지남 -> 초기화 처리
          state.steps = 0;
          state.goalReachedToday = false;
          state.easterEggShown = false;
          state.currentDateKey = nowKey;
          shownMile = -1;
          cachedBaseLifetimeSteps = null; // 누적 걸음수 갱신
          renderHistory(0);
        }

        const milestoneBefore = shownMile;
	    const prev2k = Math.floor(state.steps / 2000);
	    state.steps += n;
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

  // ---- step detection (accelerometer peak counting) ----
  let lastMag = 0, smoothed = 0, rising = false, peak = 0, valley = 99;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
    // low-pass filter
    smoothed = smoothed * 0.8 + mag * 0.2;

    const now = e.timeStamp || performance.now();
    // dynamic peak detection
    if (smoothed > lastMag) {
      rising = true;
      peak = smoothed;
    } else if (smoothed < lastMag && rising) {
      // we just passed a local maximum
      rising = false;
      const amplitude = peak - valley;
      const gap = now - state.lastStepTime;
      // thresholds: amplitude > 1.2 m/s^2 swing, min 250ms between steps
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
    // 진동 피드백 (손맛)
    if (navigator.vibrate) navigator.vibrate([10]);
  }

  function setSensor(on, txt) {
    $('dot').classList.toggle('on', on);
    $('sensorTxt').textContent = txt;
  }

  async function syncHealthKit() {
    if (window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.Health) {
      try {
        const Health = window.Capacitor.Plugins.Health;
        
        // 1. Availability check
        if (typeof Health.isAvailable === 'function') {
          const avail = await Health.isAvailable();
          if (!avail.available) {
            console.warn("Health access is not available on this platform/device:", avail.reason);
            return;
          }
        }
        
        // 2. Request authorization (support both requestAuthorization and legacy requestPermissions)
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
        
        // 3. Query steps (support queryAggregated and legacy query)
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
          $('msg').textContent = `건강 앱에서 ${hkSteps.toLocaleString()}보를 동기화했어요.`;
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
            return 1; // Success
          } catch (e) {
            console.error("Background task sync failed:", e);
            return 0; // Failed
          }
        });
        
        await BackgroundTask.registerTaskAsync(SYNC_TASK, {
          minimumInterval: 30,
          requiresNetwork: false
        });
        
        console.log("Background Task registered.");
      } catch (err) {
        console.error("Background Task 등록 실패:", err);
      }
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
    if (shownMile < 0) say(pick(noaLines.start));
  }
  function stop() {
    window.removeEventListener('devicemotion', onMotion);
    state.running = false;
    setSensor(false, '측정 정지됨');
    $('toggle').textContent = '측정 시작';
    $('toggle').classList.remove('stop');
    say(pick(noaLines.stop));
  }

  // ---- events ----
  $('toggle').onclick = () => state.running ? stop() : start();
  $('reset').onclick = () => {
    if (confirm('오늘 걸음 수를 0으로 초기화할까요?')) {
      state.steps = 0; shownMile = -1; state.goalReachedToday = false;
      render(); renderHistory(0); save();
      say(pick(noaLines.greeting));
    }
  };
  $('add').onclick = () => addSteps(10);
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
  let bgmOn = false;
  let bgmAudio = null;
  $('bgm-btn').onclick = () => {
    bgmOn = !bgmOn;
    const btn = $('bgm-btn');
    if (navigator.vibrate) navigator.vibrate([15]);
    
    if (bgmOn) {
      btn.classList.add('on');
      btn.textContent = '🎵 BGM 재생중';
      if (!bgmAudio) {
        bgmAudio = new Audio('voice/bgm.mp3');
        bgmAudio.loop = true;
      }
      bgmAudio.play().catch(e => {
        showMomotalk("BGM 파일(voice/bgm.mp3)을 찾을 수 없습니다.");
        bgmOn = false;
        btn.classList.remove('on');
        btn.textContent = '🎵 BGM 꺼짐';
      });
    } else {
      btn.classList.remove('on');
      btn.textContent = '🎵 BGM 꺼짐';
      if (bgmAudio) bgmAudio.pause();
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
    
    // 모모톡 효과음 재생 시도
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audio.play().catch(e => console.log('Audio play failed', e));

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
  $('settings-btn').onclick = () => {
    $('user-height').value = localStorage.getItem('noa-user-height') || 170;
    $('user-weight').value = localStorage.getItem('noa-user-weight') || 65;
    $('elevenlabs-key').value = localStorage.getItem('noa-elevenlabs-key') || '';
    $('elevenlabs-voice').value = localStorage.getItem('noa-elevenlabs-voice') || '';
    $('settings-modal').classList.remove('hidden');
  };
  $('settings-close').onclick = () => {
    const h = $('user-height').value;
    const w = $('user-weight').value;
    const key = $('elevenlabs-key').value.trim();
    const voice = $('elevenlabs-voice').value.trim();
    
    if (h) localStorage.setItem('noa-user-height', h);
    if (w) localStorage.setItem('noa-user-weight', w);
    
    localStorage.setItem('noa-elevenlabs-key', key);
    ELEVENLABS_API_KEY = key;
    localStorage.setItem('noa-elevenlabs-voice', voice);
    ELEVENLABS_VOICE_ID = voice;
    
    $('settings-modal').classList.add('hidden');
    render(); // 바뀐 설정으로 다시 계산
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
        btnHtml = `<button onclick="purchaseItem('${item.id}', ${item.cost})" style="background:#7dd3fc; color:#0f172a; padding:6px 12px; font-size:12px; font-weight:bold; border-radius:8px; border:none; cursor:pointer;">${item.cost} 구매</button>`;
      } else if (item.type === 'theme') {
        if (isEquipped) {
          btnHtml = `<button disabled style="background:rgba(255,255,255,0.1); color:var(--good); padding:6px 12px; font-size:12px; border-radius:8px; border:1px solid var(--good);">적용됨</button>`;
        } else {
          btnHtml = `<button onclick="equipTheme('${item.id}')" style="background:rgba(255,255,255,0.1); color:#fff; padding:6px 12px; font-size:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.4); cursor:pointer;">적용하기</button>`;
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
    addSteps(10000);
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
  window.purchaseItem = purchaseItem;
  window.equipTheme = equipTheme;

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

  // 모모톡 히스토리 모달 UI
  $('momotalk-btn').onclick = () => {
    const list = $('momotalk-history-list');
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem('noa-momotalk-hist')) || []; } catch(e) {}
    if (hist.length === 0) {
      list.innerHTML = '<div style="text-align:center; color:#fb7299; margin-top:20px; font-weight:bold;">아직 기록된 대화가 없습니다.</div>';
    } else {
      list.innerHTML = hist.map(h => {
        const d = new Date(h.time);
        const dateStr = `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return `
          <div class="history-item">
            <div class="history-item-time">${dateStr}</div>
            <div class="history-item-msg">${h.msg}</div>
          </div>
        `;
      }).reverse().join('');
    }
    $('momotalk-history-modal').classList.remove('hidden');
  };
  $('momotalk-history-close').onclick = () => $('momotalk-history-modal').classList.add('hidden');

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
  async function setupNotifications() {
    if (window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins.LocalNotifications) {
      try {
        const LN = window.Capacitor.Plugins.LocalNotifications;
        const perm = await LN.requestPermissions();
        if (perm.display !== 'granted') return;
        
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

  // --- 리포트 공유 시스템 ---
  if ($('share-report')) {
    $('share-report').onclick = async () => {
      if (typeof html2canvas === 'undefined') {
        showMomotalk("결재 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      showMomotalk("결재 서류를 작성 중입니다... 잠시만 기다려주세요!");
      
      try {
        const panel = document.querySelector('.panel');
        // HTML2Canvas backdrop-filter 렌더링 오류 방지를 위한 임시 단색 배경
        const oldBackground = panel.style.background;
        panel.style.background = '#1a2144';
        
        // 캡처 시 불필요한 컨트롤 버튼 숨김
        const controls = document.querySelectorAll('.controls, #momotalk-btn, #achievements-btn, #settings-btn, #pyroxene-btn');
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
          border: 0
        });
        
        // 복구
        panel.style.background = oldBackground;
        controls.forEach(c => {
            if(c) c.style.display = c.dataset.oldDisplay || '';
        });
        
        const link = document.createElement('a');
        link.download = `noa-schale-report-${todayKey()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        setTimeout(() => showMomotalk("주간 활동 리포트가 기기에 저장되었습니다!"), 500);
      } catch (e) {
        showMomotalk("리포트 작성에 실패했습니다.");
        console.error(e);
      }
    };
  }

  // init
  $('date').textContent = new Date().toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' });
  load();
  shownMile = milestoneIndexFor(Math.min(state.steps / state.goal, 1));
  syncHealthKit();
  initBackgroundTasks();
  setupAppLifecycle();
  setupNotifications();
  renderPyroxene();
  applyPurchasedItems();
  renderHistory(Math.min(state.steps / state.goal, 1));
  render();
  updateVoiceBtn();
  $('msg').textContent = state.steps > 0
    ? `오늘 ${state.steps.toLocaleString()}보까지 기록해 뒀어요.`
    : pick(noaLines.greeting);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();