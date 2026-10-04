// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
export type Language = 'ko' | 'en';
export const browserLanguage = (language: string): Language => /^ko(?:-|$)/i.test(language) ? 'ko' : 'en';
const ko = {
  pageTitle:'가릉빈가 Kalavinka — 무료 절차적 노동요 생성기',
  overviewTitle:'가릉빈가 소개와 사용법',
  overviewIntro:'가릉빈가(Kalavinka)는 작업과 공부할 때 들을 무료 절차적 음악 생성기입니다. 로그인이나 음악 생성 API 없이 Web Audio 엔진이 브라우저에서 보컬 없는 배경 음악을 합성합니다.',
  overviewMoodsTitle:'세 가지 음악 분위기',
  overviewMoods:'따뜻한 책상은 로파이, 고요한 공간은 앰비언트, 늦은 밤은 전자 음악 분위기입니다. 늦은 밤에서는 포 온 더 플로어와 드럼 앤 베이스 리듬을 고를 수 있습니다.',
  overviewHowTitle:'듣는 방법',
  overviewHow:'분위기를 고르고 재생을 누르세요. 템포·에너지·온기·변화·멜로디 반복성·리버브·볼륨을 조절하고, 화음·베이스·리듬·멜로디·아르페지오의 음색과 음소거를 각각 선택할 수 있습니다. 새 흐름을 누르면 다른 곡 구성을 만듭니다.',
  overviewSaveTitle:'구절 저장과 설정 공유',
  overviewSave:'하트는 현재 8마디 구절을 이 브라우저에 최대 12개까지 저장합니다. 링크 버튼은 음악 설정을 공유하며 저장한 구절이나 녹음한 음원을 보내지는 않습니다. 설정과 즐겨찾기는 브라우저 로컬 저장소에 보관되며, 계정 동기화와 음원 파일 내보내기는 제공하지 않습니다.',
  overviewTimer:'계속 재생하거나 25/50분 집중 타이머를 사용할 수 있습니다. 한국어·영어, 밝음·어두움 테마와 집중 화면을 지원합니다. 탭을 닫거나 기기가 잠자기에 들어가면 재생이 멈출 수 있습니다.',
  overviewRepository:'GitHub 프로젝트 문서',
  melodyRepetition:'멜로디 반복성', repetitionOff:'끔', repetitionLow:'약', repetitionNormal:'보통', repetitionHigh:'강',
  repetitionTip:'끔: 새 음형 · 약: 짧은 특징 반복 · 보통: 모티프 반복·발전 · 강: 같은 음형을 오래 유지. 멜로디는 계속 연주됩니다.',
  appName:'가릉빈가', home:'가릉빈가 홈', language:'언어', korean:'한국어', english:'영어',
  theme:'화면 테마', light:'밝은 테마', dark:'어두운 테마', system:'시스템 테마',
  lofi:'따뜻한 책상', ambient:'고요한 공간', dub:'늦은 밤', atmosphere:'음악 분위기', player:'음악 플레이어', waveform:'전체 출력 파형', sky:'소리에 반응하는 별하늘', chords:'코드 진행',
  play:'재생', stop:'정지', playMusic:'음악 재생', stopMusic:'음악 정지', preparing:'준비 중', playing:'재생 중', pending:'다음 마디에 반영', regenerate:'새 흐름', save:'현재 8마디 저장', share:'음악 설정 링크 복사',
  groove:'리듬 패턴', straight:'포 온 더 플로어', dnb:'드럼 앤 베이스', focus:'집중 화면', full:'전체 화면', instruments:'악기', harmony:'화음', bass:'베이스', rhythm:'리듬', motif:'멜로디', arpeggio:'아르페지오', timbre:'{part} 음색', legacy:'기존 음색',
  controls:'조절', reset:'기본값', resetLabel:'슬라이더를 기본값으로 복원', bpm:'템포', energy:'에너지', warmth:'온기', evolution:'변화', reverb:'리버브', volume:'볼륨', help:'{label} 설명',
  energyTip:'음표와 리듬의 밀도', warmthTip:'건반·멜로디의 고음을 부드럽게', evolutionTip:'모티프 변주의 폭과 빈도',
  timer:'타이머', focusTimer:'집중 타이머', continuous:'계속', minutes:'{count}분', saved:'저장한 음악', loadSaved:'{name} {seed} 불러오기', deleteSaved:'{name} {seed} 저장 삭제',
  terms:'이용 조건', about:'앱 정보', close:'닫기', portfolio:'개발자 포트폴리오', authorPortfolio:'Yakshawan 개발자 포트폴리오', thirdParty:'외부 구성요소', rights:'모든 권리 보유.',
  aboutMusic:'30종 코드 진행에 화음, 프레이즈, 베이스와 리듬을 배치합니다. 구간 끝의 코드 변형과 간헐적인 드럼 필인이 이어집니다. 비트가 쉬는 구간과 아르페지오가 이어지고, 변화 값을 높이면 다음 편곡에서 프레이즈가 더 자주 바뀝니다.',
  aboutPrivacy:'음악은 브라우저에서 합성하고 EQ·컴프레션·피크 제어로 전체 출력을 다듬습니다. 설정과 저장한 음악은 이 브라우저에 보관되며 공유 링크에는 음악 설정이 담깁니다. 기존에 저장한 음악과 링크는 이전 생성 규칙으로 재생됩니다.',
  aboutKeys:'스페이스 키: 재생·정지. 탭을 닫거나 기기가 잠자기에 들어가면 재생이 멈출 수 있습니다.',
  description:'로그인 없이 브라우저에서 만드는 무료 작업·공부용 배경 음악. 로파이·앰비언트·전자 음악 분위기를 고르고, 악기와 템포를 조절하고, 마음에 드는 구절을 저장하세요.', album:'당신의 속도로 흐르는 음악',
  storageFailed:'브라우저 저장 공간을 사용할 수 없어 이번 설정은 저장되지 않았어요.', startFailed:'음악을 시작하지 못했어요. 다시 시도해 주세요.', changeFailed:'음악을 바꾸지 못했어요. 다시 재생해 주세요.',
  audioUnavailable:'오디오 엔진을 시작하지 못했어요. 최신 Chrome·Edge·Firefox에서 다시 시도해 주세요.', audioLocked:'오디오가 잠겨 있어요. 재생 버튼을 다시 눌러 주세요.', audioError:'음악 재생 중 오류가 생겼어요. 정지 후 다시 재생해 주세요.',
  alreadySaved:'이미 저장한 구절이에요.', savedLimit:'12개까지 저장할 수 있어요. 이전 구절을 지우고 새로 저장해 주세요.', savedDone:'지금 구절의 8마디를 저장했어요.', savedTemporary:'브라우저 저장 공간이 없어 새로고침하면 저장이 사라져요.', deleted:'저장한 구절을 지웠어요.',
  copied:'음악 설정 링크를 복사했어요.', copyFailed:'링크를 복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.', timerReady:'재생을 시작하면 {count}분 타이머가 시작돼요.', timerDone:'집중 시간이 끝났어요. 잠깐 쉬어가세요.', sharedLoaded:'공유한 흐름을 불러왔어요. 재생을 눌러 시작하세요.', resetDone:'현재 분위기의 슬라이더 기본값으로 복원했어요.',
} as const;
export type TextKey = keyof typeof ko;
const en: Record<TextKey, string> = {
  pageTitle:'Kalavinka — Free generative work music',
  overviewTitle:'About Kalavinka and how to listen',
  overviewIntro:'Kalavinka is a free procedural music generator for work and study. Its Web Audio engine synthesizes instrumental background music in your browser, without sign-in or a music generation API.',
  overviewMoodsTitle:'Three music moods',
  overviewMoods:'Choose Warm desk for lo-fi, Quiet space for ambient, or After hours for electronic music. After hours offers four-on-the-floor and drum & bass rhythms.',
  overviewHowTitle:'How to listen',
  overviewHow:'Choose a mood and press Play. Adjust tempo, energy, warmth, variation, melody repetition, reverb and volume. Choose sounds and mute harmony, bass, rhythm, melody or arpeggio separately. New flow creates another composition.',
  overviewSaveTitle:'Save phrases and share settings',
  overviewSave:'The heart saves the current eight-bar phrase to this browser, with up to 12 favorites. The link button shares music settings, not the saved phrase or an audio recording. Settings and favorites use local browser storage; there is no account sync or audio file export.',
  overviewTimer:'Use continuous playback or a 25/50-minute focus timer. The player supports Korean and English, light and dark themes, and a focus view. Closing the tab or putting the device to sleep may stop playback.',
  overviewRepository:'Project documentation on GitHub',
  melodyRepetition:'Melody repetition', repetitionOff:'Off', repetitionLow:'Low', repetitionNormal:'Normal', repetitionHigh:'High',
  repetitionTip:'Off: fresh gestures · Low: short recurring hooks · Normal: repeat and develop · High: hold the theme longer. Melody keeps playing.',
  appName:'Kalavinka', home:'Kalavinka home', language:'Language', korean:'Korean', english:'English',
  theme:'Theme', light:'Light theme', dark:'Dark theme', system:'System theme',
  lofi:'Warm desk', ambient:'Quiet space', dub:'After hours', atmosphere:'Music mood', player:'Music player', waveform:'Output waveform', sky:'Sound-reactive starfield', chords:'Chord progression',
  play:'Play', stop:'Stop', playMusic:'Play music', stopMusic:'Stop music', preparing:'Preparing', playing:'Playing', pending:'Changes on the next bar', regenerate:'New flow', save:'Save these 8 bars', share:'Copy music settings link',
  groove:'Rhythm pattern', straight:'Four on the floor', dnb:'Drum & bass', focus:'Focus view', full:'Full view', instruments:'Instruments', harmony:'Harmony', bass:'Bass', rhythm:'Rhythm', motif:'Melody', arpeggio:'Arpeggio', timbre:'{part} sound', legacy:'Legacy sound',
  controls:'Controls', reset:'Reset', resetLabel:'Reset sliders to defaults', bpm:'Tempo', energy:'Energy', warmth:'Warmth', evolution:'Variation', reverb:'Reverb', volume:'Volume', help:'About {label}',
  energyTip:'Density of notes and rhythm', warmthTip:'Soften highs in harmony and melody', evolutionTip:'Depth and frequency of motif variations',
  timer:'Timer', focusTimer:'Focus timer', continuous:'Continuous', minutes:'{count} min', saved:'Saved music', loadSaved:'Load {name} {seed}', deleteSaved:'Delete saved {name} {seed}',
  terms:'Terms', about:'About', close:'Close', portfolio:'Developer portfolio', authorPortfolio:'Yakshawan developer portfolio', thirdParty:'Third-party notices', rights:'All rights reserved.',
  aboutMusic:'Harmony, phrases, bass and rhythm follow 30 chord progressions. Alternate endings and occasional drum fills connect sections, with beatless passages and arpeggios along the way. Increase Variation to change phrases more often in later arrangements.',
  aboutPrivacy:'Music is synthesized in your browser and shaped with EQ, compression and peak control. Settings and saved music stay in this browser; shared links contain music settings. Previously saved music and links keep their original composition rules.',
  aboutKeys:'Space: play or stop. Closing the tab or putting your device to sleep may stop playback.',
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
 'm-bell':['벨','Bell'], 'm-marimba':['마림바','Marimba'], 'm-flute':['소프트 플루트','Soft flute'], 'm-pluck':['플럭','Pluck'],
};
export const instrumentName = (id: string, language: Language) => sounds[id]?.[language === 'ko' ? 0 : 1] ?? translate(language,'legacy');
