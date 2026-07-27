// 모모런 오리지널 샘플 캐릭터 데이터 — 루미.
// 특정 작품의 설정이나 자산 없이 엔진을 시연하기 위한 visual + dialogue 기본팩.
(() => {
  const lumi = {
    id: 'lumi',
    name: '루미',
    shortName: '루미',
    label: 'LUMI',
    avatar: 'original/lumi/avatar.jpg',
    availability: ['lite', 'life'],
    origin: {
      type: 'original',
      notice: '모모런용 오리지널 샘플 캐릭터',
    },
    ui: {
      selectorLiteTitle: '라이트 버전',
      selectorLiteAction: '라이트로 시작',
      selectorRights: '루미 오리지널 샘플 포함',
      liteTitle: '라이트 버전',
      liteFooter: '루미는 모모런용 오리지널 샘플 캐릭터입니다.',
      memoLabel: '{name} · WALK NOTE',
      lifeTtsNote: 'TTS는 기기 내장 음성합성이며 별도 캐릭터 음원을 사용하지 않습니다.',
      lifeRights: '루미는 모모런 엔진 시연을 위해 만든 오리지널 샘플 캐릭터입니다.',
      settingsBaseNote: '대사와 반응은 모모런 오리지널 루미 기본팩을 사용합니다.',
    },

    theme: {
      backgrounds: {
        default: {
          id: 'lumi_default',
          name: '배경: 아침 산책로',
          cost: 0,
          mobile: 'original/lumi/mobile.jpg',
          desktop: 'original/lumi/mobile.jpg',
        },
        variants: [],
        modeCards: {
          schale: 'original/lumi/mobile.jpg',
          lite: 'original/lumi/mobile.jpg',
          life: 'original/lumi/mobile.jpg',
        },
      },
      surfaces: {
        selector: {
          metaThemeColor: '#15373c',
          customAccentVariables: ['--cyan', '--cyan-deep'],
          variables: {
            '--ink': '#17333a',
            '--muted': '#637b7d',
            '--cyan': '#55c7b6',
            '--cyan-deep': '#217f78',
            '--lavender': '#e37767',
            '--paper': '#f4fbf9',
            '--navy': '#15373c',
          },
        },
        schale: {
          metaThemeColor: '#15373c',
          customAccentVariables: ['--cyan', '--blue'],
          variables: {
            '--bg': '#15373c',
            '--bg2': '#24515a',
            '--panel': 'rgba(16, 49, 55, 0.68)',
            '--line': 'rgba(126, 224, 207, 0.28)',
            '--violet': '#ee8d78',
            '--violet-deep': '#d76352',
            '--violet-soft': '#ffc1b5',
            '--cyan': '#6ed8c8',
            '--blue': '#73cce5',
            '--gold': '#f0c66b',
            '--text': '#f3fffc',
            '--muted': '#bad4d0',
            '--track': 'rgba(110, 216, 200, 0.16)',
            '--good': '#84d79c',
            '--ink': 'rgba(8, 35, 39, 0.45)',
          },
        },
        lite: {
          metaThemeColor: '#0d292e',
          customAccentVariables: ['--cyan-soft'],
          variables: {
            '--bg': '#0d292e',
            '--violet-soft': '#ffb8aa',
            '--cyan-soft': '#76dfcf',
            '--good': '#84d79c',
          },
        },
        life: {
          metaThemeColor: '#17383e',
          customAccentVariables: ['--cyan', '--cyan-bright'],
          variables: {
            '--ink': '#17343a',
            '--ink-soft': '#31545a',
            '--muted': '#6c8183',
            '--line': '#ccdfdb',
            '--paper': '#f8fdfb',
            '--canvas': '#e9f3f0',
            '--cyan': '#3cae9c',
            '--cyan-bright': '#84e0d2',
            '--cyan-soft': '#ddf4ef',
            '--lavender': '#dc7566',
            '--mint': '#45a884',
            '--rose': '#d76d7b',
            '--gold': '#b18a38',
          },
        },
        adventure: {
          metaThemeColor: '#15373c',
          customAccentVariables: ['--cyan', '--cyan-bright'],
          variables: {
            '--navy': '#15373c',
            '--navy-2': '#24515a',
            '--paper': '#eef9f6',
            '--ink': '#17343a',
            '--muted': '#6b8283',
            '--cyan': '#55c7b6',
            '--cyan-bright': '#8ee7d9',
            '--violet': '#e37767',
            '--green': '#69bd89',
            '--gold': '#ddb95c',
            '--danger': '#df7b7b',
          },
        },
      },
    },

    adventure: {
      start: { x: 11, y: 86 },
      opening: '아침 산책로에서 출발해요. 오늘 걸음에 맞춰 다섯 구간을 천천히 지나가 볼까요?',
      complete: '오늘 산책 경로를 모두 걸었어요. 마지막 걸음까지 산책 노트에 잘 적어 뒀습니다.',
      checkpoints: [
        {
          id: 'morning-gate',
          name: '아침 입구',
          p: 0.20,
          point: { x: 26, y: 70 },
          line: '첫 구간을 지났어요. 몸이 깨어나는 속도에 맞춰 천천히 이어가요.',
          memory: { title: '산뜻한 출발', note: '오늘의 첫 걸음을 가볍게 남긴 아침 입구입니다.' },
        },
        {
          id: 'tree-road',
          name: '나무 산책길',
          p: 0.40,
          point: { x: 59, y: 78 },
          line: '나무 산책길에 도착했어요. 일정한 걸음이 아주 편안하게 이어지고 있어요.',
          memory: { title: '초록 사이의 보폭', note: '그늘과 햇살 사이로 이어진 오늘의 산책 기록입니다.' },
        },
        {
          id: 'river-bench',
          name: '강변 벤치',
          p: 0.60,
          point: { x: 84, y: 55 },
          line: '절반을 넘었어요. 강변에서 잠깐 호흡을 고르고 가도 좋아요.',
          memory: { title: '절반의 쉼표', note: '잠시 쉬어간 시간도 오늘 산책의 소중한 일부입니다.' },
        },
        {
          id: 'flower-turn',
          name: '꽃길 모퉁이',
          p: 0.80,
          point: { x: 65, y: 28 },
          line: '꽃길 모퉁이까지 왔어요. 오늘 목표가 이제 가까이 보여요.',
          memory: { title: '목표 전의 꽃길', note: '조금 더 걸을 힘을 건네준 밝은 길을 기록했습니다.' },
        },
        {
          id: 'sky-deck',
          name: '하늘 전망대',
          p: 1.00,
          point: { x: 29, y: 16 },
          line: '오늘 목표를 모두 채웠어요. 수고했어요. 이제 기분 좋게 쉬어요.',
          memory: { title: '완성된 산책 노트', note: '오늘의 모든 걸음이 한 장의 산책 노트로 완성됐습니다.' },
        },
      ],
    },

    birthday: {
      month: 1,
      day: 1,
      steps: 12000,
      message: '숨은 산책 메모를 찾았어요. 12,000보를 정확히 채운 오늘의 기록은 특별히 표시해 둘게요!',
    },

    ranks: [
      { min: 500000, level: 5, title: '평생 산책 메이트' },
      { min: 100000, level: 4, title: '믿음직한 동행' },
      { min: 50000, level: 3, title: '꾸준한 페이스' },
      { min: 10000, level: 2, title: '산책 친구' },
      { min: 0, level: 1, title: '첫 걸음' },
    ],

    lines: {
      greetingByTime: {
        morning: ['좋은 아침이에요. 상쾌하게 한 걸음부터 시작해요.', '아침 공기가 좋아요. 오늘 산책 노트를 열어 볼까요?'],
        afternoon: ['잠깐 몸을 움직이기 좋은 오후예요.', '지금 속도 그대로, 편안하게 걸어 봐요.'],
        night: ['늦은 시간에는 무리하지 않아도 괜찮아요.', '오늘 걸음은 여기까지여도 충분해요. 편히 쉬어요.'],
      },
      start: ['산책 노트를 시작할게요.', '편안한 속도로 함께 걸어요.', '오늘의 첫 걸음을 기록했어요.'],
      stop: ['여기까지 잘 적어 뒀어요. 쉬었다 이어가도 돼요.', '오늘 산책은 잠시 멈춤. 기록은 그대로 남아 있어요.'],
      memorial: [
        '잠깐 쉬는 시간도 산책의 일부예요.',
        '오늘 보았던 좋은 풍경이 있었나요? 산책 노트에 함께 기억해 둘게요.',
        '서두르지 않아도 괜찮아요. 편안한 걸음이 가장 오래 이어지니까요.',
      ],
      returnAfterBreak: [
        '다시 만나서 반가워요. 비어 있던 날은 그대로 두고 오늘부터 가볍게 걸어요.',
        '오랜만이에요. 지난 기록보다 지금의 한 걸음이 더 중요해요.',
        '쉬어간 만큼 천천히 시작해요. 오늘 걸음부터 새로 적으면 충분합니다.',
      ],
      milestones: [
        { p: 0.25, t: '좋은 출발이에요. 몸이 가볍게 깨어나고 있어요.' },
        { p: 0.50, t: '절반을 걸었어요. 지금 속도가 아주 편안해 보여요.' },
        { p: 0.75, t: '목표가 가까워요. 무리하지 않고 조금만 더 가요.' },
        { p: 1.00, t: '오늘 목표를 채웠어요. 정말 수고했어요.' },
      ],
      life: {
        greeting: {
          morning: '좋은 아침이에요. 오늘의 첫 걸음을 함께 적어요.',
          afternoon: '오늘 걸음이 차분하게 쌓이고 있어요.',
          night: '오늘 산책 기록을 편안하게 확인해 볼까요?',
        },
        memo: {
          done: '오늘 목표를 달성했어요. 산책 노트에 잘 표시해 뒀습니다.',
          almost: '목표까지 조금 남았어요. 짧게 걷고 마무리해도 좋아요.',
          half: '절반을 넘었어요. 지금의 편안한 흐름을 이어가요.',
          progress: '오늘의 걸음이 산책 노트에 차곡차곡 쌓이고 있어요.',
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
        start: '산책 노트: 기록을 시작합니다.',
        reactions: [
          { p: 0.50, t: '절반까지 왔어요. 지금 속도면 충분해요.' },
          { p: 1.00, t: '오늘 목표 달성. 기분 좋게 마무리해요.' },
        ],
        memo: {
          done: '오늘 목표를 채웠어요. 정말 수고했어요.',
          almost: '목표까지 조금 남았어요. 짧은 산책이면 충분해요.',
          progress: '오늘 걸음이 남았어요. 편안한 속도로 이어가요.',
          idle: '기록 시작을 누르면 오늘 걸음을 산책 노트에 적어요.',
        },
      },
    },

    notifications: {
      schale: {
        morning: '좋은 아침이에요. 오늘 산책 노트를 시작해 볼까요?',
        evening: '오늘 하루도 수고했어요. 걸음 기록을 한번 확인해요.',
      },
      life: {
        morning: '좋은 아침이에요. 가볍게 한 걸음부터 시작해요.',
        evening: '오늘 하루도 수고했어요. 산책 기록을 확인해 볼까요?',
      },
    },
  };

  window.MomoCharacterCatalog = window.MomoCharacterCatalog || {};
  window.MomoCharacterCatalog.lumi = lumi;
})();
