// 모모런 기본 동행팩 — 이름 없는 동행자.
// 사용자가 자기 최애를 얹는 "빈 액자" 팩. 특정 작품·관계·호칭을 가정하지 않는 중립 대사만 담는다.
// (설정에서 이름·색·사진을 바꾸면 이 팩 위에 덮여, 어떤 최애를 넣어도 말투가 어긋나지 않는다.)
(() => {
  const companion = {
    id: 'companion',
    name: '동행자',
    shortName: '동행자',
    label: 'COMPANION',
    avatar: 'original/companion/avatar.jpg',
    availability: ['lite', 'life'],
    origin: {
      type: 'original',
      notice: '이름·사진을 직접 채우는 모모런 기본 동행팩',
    },
    ui: {
      selectorLiteTitle: '라이트 버전',
      selectorLiteAction: '라이트로 시작',
      selectorRights: '기본 동행팩 포함',
      liteTitle: '라이트 버전',
      liteFooter: '설정에서 이름과 사진을 바꾸면 나만의 동행자가 됩니다.',
      memoLabel: '{name} · WALK NOTE',
      lifeTtsNote: 'TTS는 기기 내장 음성합성이며 별도 캐릭터 음원을 사용하지 않습니다.',
      lifeRights: '기본 동행팩은 특정 작품의 캐릭터가 아닌 모모런 기본 제공 팩입니다.',
      settingsBaseNote: '대사와 반응은 중립적인 기본 동행팩을 사용합니다. 이름·색·사진만 바꿔도 어울립니다.',
    },

    theme: {
      backgrounds: {
        default: {
          id: 'companion_default',
          name: '배경: 기본 (사진을 넣으면 교체됩니다)',
          cost: 0,
          mobile: 'original/companion/mobile.jpg',
          desktop: 'original/companion/desktop.jpg',
        },
        variants: [],
        modeCards: {
          schale: 'original/companion/mobile.jpg',
          lite: 'original/companion/mobile.jpg',
          life: 'original/companion/mobile.jpg',
        },
      },
      surfaces: {
        selector: {
          metaThemeColor: '#26303f',
          customAccentVariables: ['--cyan', '--cyan-deep'],
          variables: {
            '--ink': '#212c3c',
            '--muted': '#6d7a8c',
            '--cyan': '#7ea6c9',
            '--cyan-deep': '#3f6289',
            '--lavender': '#9aa7c4',
            '--paper': '#f6f8fb',
            '--navy': '#26303f',
          },
        },
        schale: {
          metaThemeColor: '#222c3b',
          customAccentVariables: ['--cyan', '--blue'],
          variables: {
            '--bg': '#222c3b',
            '--bg2': '#33415a',
            '--panel': 'rgba(24, 32, 45, 0.66)',
            '--line': 'rgba(158, 184, 214, 0.26)',
            '--violet': '#9aa7c4',
            '--violet-deep': '#6d7fa6',
            '--violet-soft': '#c3cee2',
            '--cyan': '#8fb4d6',
            '--blue': '#9cc2de',
            '--gold': '#e8c98b',
            '--text': '#f2f5fa',
            '--muted': '#c0cad9',
            '--track': 'rgba(143, 180, 214, 0.16)',
            '--good': '#8fcfae',
            '--ink': 'rgba(14, 19, 28, 0.45)',
          },
        },
        lite: {
          metaThemeColor: '#171e29',
          customAccentVariables: ['--cyan-soft'],
          variables: {
            '--bg': '#171e29',
            '--violet-soft': '#c3cee2',
            '--cyan-soft': '#8fb4d6',
            '--good': '#8fcfae',
          },
        },
        life: {
          metaThemeColor: '#232e3d',
          customAccentVariables: ['--cyan', '--cyan-bright'],
          variables: {
            '--ink': '#222d3c',
            '--ink-soft': '#3c4a5e',
            '--muted': '#6f7d90',
            '--line': '#d3dae4',
            '--paper': '#f9fbfd',
            '--canvas': '#eaeff5',
            '--cyan': '#4b7ba6',
            '--cyan-bright': '#8fbcdd',
            '--cyan-soft': '#e2ecf5',
            '--lavender': '#8e9ab6',
            '--mint': '#48997f',
            '--rose': '#b9707f',
            '--gold': '#a5813c',
          },
        },
        adventure: {
          metaThemeColor: '#1c2634',
          customAccentVariables: ['--cyan', '--cyan-bright'],
          variables: {
            '--navy': '#1c2634',
            '--navy-2': '#2b384b',
            '--paper': '#eff4f9',
            '--ink': '#212c3c',
            '--muted': '#6f7d90',
            '--cyan': '#7ea6c9',
            '--cyan-bright': '#a8cdea',
            '--violet': '#9aa7c4',
            '--green': '#72b795',
            '--gold': '#d9b978',
            '--danger': '#d98686',
          },
        },
      },
    },

    // 특정 지명 없이 "오늘의 코스"로만 구성한 중립 산책 경로.
    adventure: {
      start: { x: 11, y: 86 },
      opening: '오늘의 코스를 준비했어요. 걸음에 맞춰 다섯 구간을 천천히 지나가 볼까요?',
      complete: '오늘 코스를 모두 걸었어요. 마지막 걸음까지 잘 기록해 뒀습니다.',
      checkpoints: [
        {
          id: 'start-point',
          name: '출발 지점',
          p: 0.2,
          point: { x: 26, y: 70 },
          line: '첫 구간을 지났어요. 몸이 풀리는 속도에 맞춰 이어가요.',
          memory: { title: '오늘의 첫 걸음', note: '가볍게 시작한 오늘의 출발 지점입니다.' },
        },
        {
          id: 'long-road',
          name: '긴 길',
          p: 0.4,
          point: { x: 59, y: 78 },
          line: '긴 길에 들어섰어요. 일정한 걸음이 편안하게 이어지고 있어요.',
          memory: { title: '고른 보폭', note: '한결같은 속도로 이어간 구간을 기록했습니다.' },
        },
        {
          id: 'halfway-rest',
          name: '중간 쉼터',
          p: 0.6,
          point: { x: 84, y: 55 },
          line: '절반을 넘었어요. 잠깐 숨을 고르고 가도 좋아요.',
          memory: { title: '절반의 쉼표', note: '잠시 쉬어간 시간도 오늘 걸음의 일부입니다.' },
        },
        {
          id: 'last-turn',
          name: '마지막 모퉁이',
          p: 0.8,
          point: { x: 65, y: 28 },
          line: '마지막 모퉁이까지 왔어요. 목표가 눈앞이에요.',
          memory: { title: '목표 직전', note: '조금 더 걸을 힘이 남아 있던 구간입니다.' },
        },
        {
          id: 'finish-view',
          name: '오늘의 끝',
          p: 1,
          point: { x: 29, y: 16 },
          line: '오늘 목표를 모두 채웠어요. 기분 좋게 마무리해요.',
          memory: { title: '완성된 하루', note: '오늘의 모든 걸음이 한 장으로 정리됐습니다.' },
        },
      ],
    },

    // 생일 대신 "특별한 기록" — 특정 캐릭터의 설정을 가정하지 않는다.
    birthday: {
      month: 1,
      day: 1,
      steps: 12000,
      message: '숨은 기록을 찾았어요. 12,000보를 정확히 채운 오늘은 특별히 표시해 둘게요!',
    },

    ranks: [
      { min: 500000, level: 5, title: '오래 함께 걸은 사이' },
      { min: 100000, level: 4, title: '든든한 동행' },
      { min: 50000, level: 3, title: '꾸준한 페이스' },
      { min: 10000, level: 2, title: '함께 걷는 중' },
      { min: 0, level: 1, title: '첫 걸음' },
    ],

    lines: {
      greetingByTime: {
        morning: ['좋은 아침이에요. 오늘도 함께 걸어요.', '아침 공기가 좋아요. 오늘 기록을 열어 볼까요?'],
        afternoon: ['잠깐 움직이기 좋은 시간이에요.', '지금 속도 그대로, 편안하게 걸어요.'],
        night: ['늦은 시간에는 무리하지 않아도 괜찮아요.', '오늘 걸음은 여기까지여도 충분해요.'],
      },
      start: [
        '기록을 시작할게요.',
        '편안한 속도로 같이 걸어요.',
        '오늘의 첫 걸음을 적었어요.',
      ],
      stop: [
        '여기까지 잘 적어 뒀어요. 쉬었다 이어가도 돼요.',
        '잠시 멈춤. 기록은 그대로 남아 있어요.',
      ],
      memorial: [
        '잠깐 쉬는 시간도 하루의 일부예요.',
        '오늘 본 풍경 중에 좋았던 게 있었나요? 같이 기억해 둘게요.',
        '서두르지 않아도 괜찮아요. 편안한 걸음이 가장 오래 이어지니까요.',
      ],
      returnAfterBreak: [
        '다시 만나서 반가워요. 비어 있던 날은 그대로 두고 오늘부터 가볍게 걸어요.',
        '오랜만이에요. 지난 기록보다 지금의 한 걸음이 더 중요해요.',
        '쉬어간 만큼 천천히 시작해요. 오늘 걸음부터 새로 적으면 충분합니다.',
      ],
      milestones: [
        { p: 0.25, t: '좋은 출발이에요. 몸이 가볍게 풀리고 있어요.' },
        { p: 0.5, t: '절반을 걸었어요. 지금 속도가 편안해 보여요.' },
        { p: 0.75, t: '목표가 가까워요. 무리하지 않고 조금만 더 가요.' },
        { p: 1, t: '오늘 목표를 채웠어요. 정말 수고했어요.' },
      ],
      life: {
        greeting: {
          morning: '좋은 아침이에요. 오늘의 첫 걸음을 함께 적어요.',
          afternoon: '오늘 걸음이 차분하게 쌓이고 있어요.',
          night: '오늘 기록을 편안하게 확인해 볼까요?',
        },
        memo: {
          done: '오늘 목표를 달성했어요. 기록에 잘 표시해 뒀습니다.',
          almost: '목표까지 조금 남았어요. 짧게 걷고 마무리해도 좋아요.',
          half: '절반을 넘었어요. 지금의 편안한 흐름을 이어가요.',
          progress: '오늘의 걸음이 차곡차곡 쌓이고 있어요.',
          healthOn: '건강 앱에서 오늘 걸음을 확인해 볼까요?',
          healthOff: '건강 앱을 연결하면 오늘 걸음을 자동으로 정리해요.',
        },
        weekly: {
          excellent: '목표를 채운 날이 고르게 이어졌어요. 이번 주 페이스가 아주 안정적이에요.',
          steady: '꾸준한 걸음이 좋은 흐름을 만들었어요. 다음 주도 지금 속도면 충분해요.',
          started: '이번 주에도 분명한 발걸음이 남았어요. 이어온 기록 자체가 소중합니다.',
          empty: '아직 비어 있는 칸은 그대로 둘게요. 오늘의 한 걸음부터 새로 시작해요.',
        },
      },
      lite: {
        start: '기록을 시작합니다.',
        reactions: [
          { p: 0.5, t: '절반까지 왔어요. 지금 속도면 충분해요.' },
          { p: 1, t: '오늘 목표 달성. 기분 좋게 마무리해요.' },
        ],
        memo: {
          done: '오늘 목표를 채웠어요. 정말 수고했어요.',
          almost: '목표까지 조금 남았어요. 짧은 산책이면 충분해요.',
          progress: '오늘 걸음이 남았어요. 편안한 속도로 이어가요.',
          idle: '기록 시작을 누르면 오늘 걸음을 정리해요.',
        },
      },
    },

    notifications: {
      schale: {
        morning: '좋은 아침이에요. 오늘 기록을 시작해 볼까요?',
        evening: '오늘 하루도 수고했어요. 걸음 기록을 한번 확인해요.',
      },
      life: {
        morning: '좋은 아침이에요. 가볍게 한 걸음부터 시작해요.',
        evening: '오늘 하루도 수고했어요. 기록을 확인해 볼까요?',
      },
    },
  };

  window.MomoCharacterCatalog = window.MomoCharacterCatalog || {};
  window.MomoCharacterCatalog.companion = companion;
})();
