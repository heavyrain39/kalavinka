// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
export type Language = 'ko' | 'en';
export const browserLanguage = (language: string): Language => /^ko(?:-|$)/i.test(language) ? 'ko' : 'en';
const ko = {
  keepInstruments:'악기 유지', keepInstrumentsTip:'새 흐름을 누르거나 분위기를 바꿔도 분위기마다 고른 악기 음색을 유지합니다.',
  pageTitle:'가릉빈가 Kalavinka — 무료 절차적 노동요 생성기',
  overviewTitle:'가릉빈가 소개와 사용법',
  overviewIntro:'가릉빈가는 작업과 공부를 위한 절차적 음악 생성기입니다. 작곡부터 합성, 마스터링까지 모든 과정이 브라우저 안에서 실시간으로 이루어지고, 하나의 시드에서 화성과 선율, 베이스와 리듬이 함께 짜여 끊김 없이 변주됩니다.',
  overviewMoodsTitle:'분위기',
  overviewMoods:'따뜻한 책상은 로파이, 고요한 공간은 앰비언트, 늦은 밤은 전자 음악입니다. 늦은 밤에서는 포 온 더 플로어와 드럼 앤 베이스를 고를 수 있습니다.',
  overviewHowTitle:'듣는 방법',
  overviewHow:'분위기를 고르고 재생을 누르세요. 슬라이더로 곡의 성격을, 악기 칸에서 파트마다 음색과 켜고 끄기를 정합니다. 새 흐름은 다른 곡을 만듭니다.',
  overviewSaveTitle:'저장과 공유',
  overviewSave:'하트는 지금 흐르는 8마디를 최대 12개까지 저장하고, 링크 버튼은 지금의 음악 설정을 공유합니다. 설정과 저장한 음악은 이 브라우저에만 남습니다.',
  overviewTimer:'스페이스 키로 재생하고 멈춥니다. 탭을 닫거나 기기가 잠자기에 들어가면 재생이 멈출 수 있습니다.',
  overviewRepository:'GitHub',
  melodyRepetition:'멜로디 반복성', repetitionOff:'끔', repetitionLow:'약', repetitionNormal:'보통', repetitionHigh:'강',
  repetitionTip:'끔: 새 음형 · 약: 짧은 특징 반복 · 보통: 모티프 반복·발전 · 강: 같은 음형을 오래 유지. 멜로디는 계속 연주됩니다.',
  appName:'가릉빈가', home:'가릉빈가 홈', language:'언어', korean:'한국어', english:'영어',
  theme:'화면 테마', light:'밝은 테마', dark:'어두운 테마', system:'시스템 테마',
  lofi:'따뜻한 책상', ambient:'고요한 공간', dub:'늦은 밤', atmosphere:'음악 분위기', player:'음악 플레이어', waveform:'지금 8마디의 멜로디와 출력 파형', sky:'소리에 반응하는 별하늘', chords:'코드 진행',
  play:'재생', stop:'정지', playMusic:'음악 재생', stopMusic:'음악 정지', preparing:'준비 중', playing:'재생 중', pending:'다음 마디에 반영', regenerate:'새 흐름', save:'현재 8마디 저장', share:'음악 설정 링크 복사',
  groove:'리듬 패턴', straight:'포 온 더 플로어', dnb:'드럼 앤 베이스', focus:'집중 화면', full:'전체 화면', instruments:'악기', harmony:'화음', bass:'베이스', rhythm:'리듬', motif:'멜로디', arpeggio:'아르페지오', timbre:'{part} 음색', legacy:'기존 음색',
  controls:'조절', reset:'기본값', resetLabel:'슬라이더를 기본값으로 복원', bpm:'템포', energy:'에너지', warmth:'온기', evolution:'변화', reverb:'리버브', volume:'볼륨', groupMusic:'음악', groupSound:'소리', help:'{label} 설명',
  energyTip:'음표와 리듬의 밀도', warmthTip:'건반·멜로디의 고음을 부드럽게', evolutionTip:'모티프 변주의 폭과 빈도',
  timer:'타이머', focusTimer:'집중 타이머', continuous:'계속', minutes:'{count}분', saved:'저장한 음악', savedEmpty:'하트를 누르면 지금 듣는 8마디가 여기에 저장됩니다.', loadSaved:'{name} {seed} 불러오기', deleteSaved:'{name} {seed} 저장 삭제',
  about:'앱 정보', close:'닫기', portfolio:'개발자 포트폴리오', authorPortfolio:'Yakshawan 개발자 포트폴리오',
  description:'로그인 없이 브라우저에서 만드는 무료 작업·공부용 배경 음악. 로파이·앰비언트·전자 음악 분위기를 고르고, 악기와 템포를 조절하고, 마음에 드는 구절을 저장하세요.', album:'당신의 속도로 흐르는 음악',
  storageFailed:'브라우저 저장 공간을 사용할 수 없어 이번 설정은 저장되지 않았어요.', startFailed:'음악을 시작하지 못했어요. 다시 시도해 주세요.', changeFailed:'음악을 바꾸지 못했어요. 다시 재생해 주세요.',
  audioUnavailable:'오디오 엔진을 시작하지 못했어요. 최신 Chrome·Edge·Firefox에서 다시 시도해 주세요.', audioLocked:'오디오가 잠겨 있어요. 재생 버튼을 다시 눌러 주세요.', audioError:'음악 재생 중 오류가 생겼어요. 정지 후 다시 재생해 주세요.',
  alreadySaved:'이미 저장한 구절이에요.', savedLimit:'12개까지 저장할 수 있어요. 이전 구절을 지우고 새로 저장해 주세요.', savedDone:'지금 구절의 8마디를 저장했어요.', savedTemporary:'브라우저 저장 공간이 없어 새로고침하면 저장이 사라져요.', deleted:'저장한 구절을 지웠어요.',
  copied:'음악 설정 링크를 복사했어요.', copyFailed:'링크를 복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.', timerReady:'재생을 시작하면 {count}분 타이머가 시작돼요.', timerDone:'집중 시간이 끝났어요. 잠깐 쉬어가세요.', sharedLoaded:'공유한 흐름을 불러왔어요. 재생을 눌러 시작하세요.', resetDone:'현재 분위기의 슬라이더 기본값으로 복원했어요.',
} as const;
export type TextKey = keyof typeof ko;
const en: Record<TextKey, string> = {
  keepInstruments:'Keep sounds', keepInstrumentsTip:'Keep the instrument sounds of each atmosphere when creating a new flow or switching atmospheres.',
  pageTitle:'Kalavinka — Free generative work music',
  overviewTitle:'About Kalavinka and how to listen',
  overviewIntro:'Kalavinka is a procedural music generator for work and study. Composition, synthesis and mastering all happen live in your browser, and a single seed weaves harmony, melody, bass and rhythm into music that keeps evolving.',
  overviewMoodsTitle:'Moods',
  overviewMoods:'Warm desk is lo-fi, Quiet space is ambient and After hours is electronic, with four-on-the-floor or drum & bass rhythms.',
  overviewHowTitle:'How to listen',
  overviewHow:'Choose a mood and press Play. The sliders shape the music, and the instrument panel sets each part\'s sound and turns it on or off. New flow composes another piece.',
  overviewSaveTitle:'Save and share',
  overviewSave:'The heart saves the eight bars now playing, up to 12, and the link button shares the current music settings. Settings and saved music stay in this browser.',
  overviewTimer:'Press Space to play or stop. Closing the tab or putting your device to sleep may stop playback.',
  overviewRepository:'GitHub',
  melodyRepetition:'Melody repetition', repetitionOff:'Off', repetitionLow:'Low', repetitionNormal:'Normal', repetitionHigh:'High',
  repetitionTip:'Off: fresh gestures · Low: short recurring hooks · Normal: repeat and develop · High: hold the theme longer. Melody keeps playing.',
  appName:'Kalavinka', home:'Kalavinka home', language:'Language', korean:'Korean', english:'English',
  theme:'Theme', light:'Light theme', dark:'Dark theme', system:'System theme',
  lofi:'Warm desk', ambient:'Quiet space', dub:'After hours', atmosphere:'Music mood', player:'Music player', waveform:'Melody of the current eight bars and the output waveform', sky:'Sound-reactive starfield', chords:'Chord progression',
  play:'Play', stop:'Stop', playMusic:'Play music', stopMusic:'Stop music', preparing:'Preparing', playing:'Playing', pending:'Changes on the next bar', regenerate:'New flow', save:'Save these 8 bars', share:'Copy music settings link',
  groove:'Rhythm pattern', straight:'Four on the floor', dnb:'Drum & bass', focus:'Focus view', full:'Full view', instruments:'Instruments', harmony:'Harmony', bass:'Bass', rhythm:'Rhythm', motif:'Melody', arpeggio:'Arpeggio', timbre:'{part} sound', legacy:'Legacy sound',
  controls:'Controls', reset:'Reset', resetLabel:'Reset sliders to defaults', bpm:'Tempo', energy:'Energy', warmth:'Warmth', evolution:'Variation', reverb:'Reverb', volume:'Volume', groupMusic:'Music', groupSound:'Sound', help:'About {label}',
  energyTip:'Density of notes and rhythm', warmthTip:'Soften highs in harmony and melody', evolutionTip:'Depth and frequency of motif variations',
  timer:'Timer', focusTimer:'Focus timer', continuous:'Continuous', minutes:'{count} min', saved:'Saved music', savedEmpty:'Press the heart to keep the eight bars you’re hearing here.', loadSaved:'Load {name} {seed}', deleteSaved:'Delete saved {name} {seed}',
  about:'About', close:'Close', portfolio:'Developer portfolio', authorPortfolio:'Yakshawan developer portfolio',
  description:'Generate free background music for work and study in your browser. Choose lo-fi, ambient or electronic moods, adjust the mix, and save phrases. No sign-in.', album:'Music at your pace',
  storageFailed:'Browser storage is unavailable. These settings were not saved.', startFailed:'Could not start the music. Please try again.', changeFailed:'Could not change the music. Press Play to try again.',
  audioUnavailable:'Could not start the audio engine. Try a recent version of Chrome, Edge or Firefox.', audioLocked:'Audio is locked. Press Play again.', audioError:'An audio error occurred. Stop and press Play to try again.',
  alreadySaved:'This phrase is already saved.', savedLimit:'You can save up to 12 phrases. Remove an older one to save another.', savedDone:'Eight-bar phrase saved.', savedTemporary:'Browser storage is unavailable. This saved phrase will be lost on reload.', deleted:'Saved phrase deleted.',
  copied:'Music settings link copied.', copyFailed:'Could not copy the link. Check your browser clipboard permissions.', timerReady:'The {count}-minute timer starts when you press Play.', timerDone:'Focus time is over. Take a short break.', sharedLoaded:'Shared flow loaded. Press Play to start.', resetDone:'Sliders reset to the current mood’s defaults.',
};
export const messages = { ko, en };
export function translate(language: Language, key: TextKey, values: Record<string, string | number> = {}): string {
  return messages[language][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}
const sounds: Record<string, readonly [string,string]> = {
 'h-felt':['펠트 건반','Felt keys'], 'h-electric':['일렉 피아노','Electric piano'], 'h-organ':['오르간','Organ'], 'h-pad':['스트링 패드','String pad'],
 'b-round':['라운드','Round'], 'b-sub':['서브','Sub'], 'b-pluck':['플럭 베이스','Plucked bass'], 'b-analog':['아날로그','Analog'],
 'r-brush':['브러시','Brush'], 'r-tape':['테이프 킷','Tape kit'], 'r-electro':['일렉트로','Electro'], 'r-click':['미니멀 킷','Minimal kit'],
 'm-bell':['벨','Bell'], 'm-marimba':['마림바','Marimba'], 'm-flute':['소프트 플루트','Soft flute'], 'm-pluck':['플럭','Pluck'], 'm-nylon':['나일론 기타','Nylon guitar'],
};
export const instrumentName = (id: string, language: Language) => sounds[id]?.[language === 'ko' ? 0 : 1] ?? translate(language,'legacy');
