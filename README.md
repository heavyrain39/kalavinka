# Kalavinka · 가릉빈가

**로그인 없이 브라우저에서 만드는 무료 작업·공부용 배경 음악.** 가릉빈가는 시드와 음악 규칙으로 화음·베이스·리듬·멜로디·아르페지오를 편곡하고, 자체 Web Audio 엔진으로 소리를 합성하는 절차적 음악 생성 웹앱입니다. 음악 생성 모델이나 외부 음원 스트리밍을 사용하지 않습니다.

**[웹앱에서 듣기](https://heavyrain39.github.io/kalavinka/)** · [사용법](#사용법) · [로컬 실행과 검증](#로컬-실행과-검증) · [라이선스](#라이선스)

Kalavinka is a free browser-based procedural music generator for work and study. Choose lo-fi, ambient or electronic moods, adjust the mix, save eight-bar phrases locally, and share music settings. No sign-in, backend or music generation API is required. The public repository uses a proprietary application license; see [LICENSE](LICENSE) before reusing or hosting the code.

## 제공 기능

| 기능 | 실제 동작 |
| --- | --- |
| 음악 분위기 | 따뜻한 책상 / Warm desk(로파이), 고요한 공간 / Quiet space(앰비언트), 늦은 밤 / After hours(전자 음악) |
| 리듬 선택 | 늦은 밤에서 포 온 더 플로어와 드럼 앤 베이스 선택. D&B는 170 BPM으로 시작 |
| 편곡 조절 | 템포 50–180 BPM, 에너지(밀도), 온기, 변화, 멜로디 반복성(끔·약·보통·강), 리버브, 볼륨 |
| 악기 | 화음·베이스·리듬·멜로디·아르페지오의 음소거와 음색 선택. 각 메뉴에 네 가지 선택지 |
| 새 흐름 | 새로운 시드와 곡 구성, 음색 조합 생성 |
| 즐겨찾기 | 현재 8마디의 악보와 설정을 이 브라우저에 최대 12개 저장 |
| 링크 공유 | 시드·생성기 버전·음색·리듬·슬라이더 등 음악 설정을 URL에 담아 복사 |
| 집중 기능 | 계속 재생, 25/50분 타이머, 집중 화면, 스페이스 키로 재생·정지 |
| 화면 | 한국어·영어, 밝음·어두움·시스템 테마, 실제 출력 파형과 소리에 반응하는 별하늘 |

현재 앱은 v0.23.1이며 새 음악에는 생성기 v16을 사용합니다. 기존 저장곡과 공유 링크는 원래 생성기 버전의 규칙을 유지합니다. 4/4 박자와 장조·단조의 30가지 코드 진행을 사용하고, 긴 구간에서 모티프와 편곡을 바꿉니다. 보컬, 음원 파일 내보내기, 계정 간 동기화, 크롬 웹스토어 배포는 제공하지 않습니다.

v0.23.1에서는 크래시의 스테레오 음색과 여운을 유지하면서 재생 음량을 20% 낮췄습니다. 크래시가 들어 있는 기존 구절에도 적용합니다. [심벌 음색 조정 기록](docs/CRASH_V16.md)

## 사용법

1. [공식 웹앱](https://heavyrain39.github.io/kalavinka/)을 열고 세 분위기 중 하나를 고릅니다.
2. **재생 / Play**를 누릅니다. 최초 재생은 브라우저의 오디오 허용을 위한 사용자 조작이 필요합니다.
3. 슬라이더와 악기 메뉴로 소리를 조절합니다. 편곡 변경은 다음 마디에 반영되며, 볼륨·리버브·음소거는 짧은 페이드로 적용됩니다. 멜로디 반복성의 **끔**은 멜로디 음소거가 아니라 새 음형을 만드는 설정입니다.
4. 다른 곡을 만들려면 **새 흐름 / New flow**를 누릅니다. **기본값 / Reset**은 현재 분위기·리듬의 일곱 슬라이더를 복원하며 악기·음소거·시드·타이머는 유지합니다.
5. 하트로 현재 구절을 저장하거나 링크 버튼으로 음악 설정을 복사합니다. 저장 목록의 이름을 누르면 해당 구절을 불러옵니다.
6. 필요하면 25/50분 타이머를 선택합니다. 타이머는 재생을 시작할 때부터 시간을 셉니다. KO/EN 전환은 음악 설정과 재생을 유지하며, 새로 열면 브라우저의 기본 언어에 따라 시작합니다.

**저장과 공유의 차이:** 하트는 지금 듣는 8마디의 실제 음표·리듬·코드·아르페지오와 설정을 로컬에 보관합니다. 구절 중간에 저장해도 불러오면 그 구절의 처음부터 재생하고, 이후에는 원래 곡의 다음 구간으로 이어집니다. 링크는 설정을 공유하며 **로컬에 저장한 8마디 악보나 녹음한 음원을 포함하지 않습니다.** 즐겨찾기는 오디오 녹음·리버브 상태·슬라이더 자동화 녹음이 아닙니다. [저장 형식과 재생 규칙](docs/SAVED_PHRASES.md)

설정과 즐겨찾기는 브라우저의 `localStorage`에 저장됩니다. 브라우저 데이터 삭제, 다른 기기·브라우저 사용, 저장 공간 제한에 따라 복원할 수 없을 수 있습니다. 공유 URL에는 음악 설정이 보이므로 링크를 받은 사람도 이를 읽을 수 있습니다. 로그인·데이터베이스·런타임 API·분석 추적은 구현되어 있지 않으며 폰트도 로컬 자산으로 제공합니다.

최신 Chrome·Edge·Firefox 등 Web Audio와 AudioWorklet을 지원하는 브라우저에서 사용하세요. 재생 탭을 열어둔 채 다른 탭에서 작업할 수 있지만, 탭 닫기·절전·브라우저의 탭 회수·오디오 출력 장치 변경은 재생을 중단할 수 있습니다. 생성은 사용자의 CPU를 사용합니다.

## 로컬 실행과 검증

Node.js **24**를 권장합니다(GitHub Actions도 24 사용). npm과 현대적인 웹 브라우저가 필요합니다. 아래 명령은 소스 확인과 허가된 개발을 위한 안내이며, 코드 수정·재사용·별도 호스팅 권한은 [LICENSE](LICENSE)를 따릅니다.

```sh
git clone https://github.com/heavyrain39/kalavinka.git
cd kalavinka
npm ci
npm run dev
```

개발 서버의 기본 주소는 `http://127.0.0.1:5173/`입니다. 포트가 사용 중이면 터미널에 출력된 주소를 확인하세요. HTML 파일을 직접 여는 대신 Vite 서버로 실행합니다.

```sh
npm test             # 음악 규칙·저장·타이밍·번역 등 Node 테스트
npm run build        # 고지 동기화 → TypeScript 검사 → Vite 빌드 → 릴리스 감사
npm run preview      # dist/ 로컬 확인, 기본 http://127.0.0.1:4173/
```

`npm run build`는 `dist/`를 만들고, 현재 및 제삼자 라이선스 고지가 포함되는지와 Strudel/fraction.js 런타임이 없는지를 검사합니다. `tests/browser/`에는 Playwright CLI에서 사용하는 브라우저 확인 스니펫이 있으며 `npm test`에는 포함되지 않습니다. [브라우저 검증 기록](docs/DECLICK_I18N.md)

## 빌드와 배포

현재 배포 대상은 **GitHub Pages**의 `https://heavyrain39.github.io/kalavinka/`입니다. [Pages 워크플로](.github/workflows/pages.yml)는 `main` push 또는 수동 실행 시 의존성을 설치하고 테스트·빌드를 통과한 `dist/`를 배포합니다. 저장소의 Pages 소스는 GitHub Actions를 사용해야 합니다. 배포에는 저장소와 Pages에 대한 권한이 필요합니다.

Vite의 `base: './'`로 JS·CSS·폰트·오디오 클록을 저장소 하위 경로에서 읽습니다. 서버·데이터베이스·API 키는 필요하지 않습니다. `npm run preview`는 로컬 확인용이며 배포 명령이 아닙니다.

### 검색과 공유 메타데이터

`index.html`에 제목·설명·canonical·Open Graph·Twitter 카드·WebApplication JSON-LD와 JavaScript 없이도 읽을 수 있는 소개/사용 안내가 있습니다. 플레이어의 KO/EN 전환은 문서 언어·제목·설명·안내를 바꿉니다. 공유 봇용 정적 메타데이터는 영어를 기본으로 하고 프로젝트 이름은 한국어도 표기합니다. 언어별 별도 URL은 제공하지 않습니다.

- `public/sitemap.xml`에는 공식 앱 URL 하나만 포함합니다. `#mix=` 공유 설정은 같은 앱의 URL 프래그먼트이므로 별도 검색 페이지로 나열하지 않습니다.
- `public/social-card.png`는 1200×630 공유 이미지입니다.
- `public/robots.txt`는 크롤링 허용과 사이트맵 주소를 담은 **참조 정책**입니다. GitHub Pages에서는 `/kalavinka/robots.txt`로 배포되지만, 검색엔진이 적용하는 파일은 도메인 루트의 `https://heavyrain39.github.io/robots.txt`입니다. 이 저장소의 파일만으로 루트 정책이나 사이트맵 자동 발견을 설정할 수 없습니다. 루트 사이트를 운영한다면 기존 규칙을 검토한 후 사이트맵 항목을 통합해야 합니다. [Google의 robots.txt 위치 규칙](https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt)

다른 도메인이나 경로로 배포하도록 허가받았다면 canonical, OG URL/이미지, Twitter 이미지, JSON-LD URL/라이선스, sitemap과 robots의 주소도 함께 바꿔야 합니다. 검색엔진 계정 등록·사이트맵 제출은 별도 운영 작업이며 이 코드에 포함되지 않습니다.

## 기술 구조

TypeScript와 Vite로 만든 정적 웹앱입니다. 런타임 음악 엔진은 자체 코드이며, npm의 애플리케이션 의존성은 로컬 폰트 패키지입니다. 현재 런타임은 Strudel을 사용하지 않습니다.

| 경로 | 역할 |
| --- | --- |
| `src/main.ts`, `src/i18n.ts`, `src/style.css` | 플레이어 UI, 언어 전환, 로컬 저장, 공유 링크, 화면 스타일 |
| `src/music.ts`, `src/score.ts`, `src/seed.ts` | 버전별 음악 규칙, 마디 단위 악보, 결정적 시드 |
| `src/harmony*`, `src/melody*`, `src/bass*`, `src/ensemble*`, `src/arrangement.ts` | 화성·선율·베이스와 구간 편곡 |
| `src/arpeggio*`, `src/drum*`, `src/fills.ts`, `src/crash.ts` | 아르페지오, 드럼 음색·연주, 필인·심벌 |
| `src/audio.ts`, `src/transport.ts`, `src/timing.ts`, `src/clock.worklet.js` | 오디오 엔진, 선행 예약, 오디오 시계 기반 타이밍 |
| `src/synth.ts`, `src/ambient.ts`, `src/reverb.ts`, `src/mastering.ts` | 합성음, 앰비언트 음향, 잔향, EQ·컴프레션·소프트 피크 제어 |
| `src/saved-phrase.ts` | 8마디 악보 캡처와 복원, 구버전 저장 호환 |
| `public/`, `scripts/`, `tests/`, `docs/` | 정적 자산·고지, 빌드 감사, 테스트, 설계와 검증 기록 |

같은 생성기 버전·시드·설정은 같은 악보와 타이밍 규칙을 재현합니다. 실제 오디오 출력은 브라우저 DSP와 샘플레이트에 따라 조금 다를 수 있습니다. 마스터링은 실시간 재생용 경량 처리이며 파일 전체 LUFS 정규화나 인증된 트루 피크 리미팅을 제공하지 않습니다.

구현 기록: [독자 엔진](docs/INDEPENDENT_ENGINE.md) · [음악 규칙](docs/PROTOTYPE_PLAN.md) · [화성·필인](docs/HARMONY_V5.md) · [멜로디](docs/MELODY_V7.md) · [아르페지오](docs/ARPEGGIO_V8.md) · [드럼](docs/DRUMS_V6.md) · [음색·리버브](docs/TIMBRE_REVERB.md) · [앰비언트](docs/AMBIENT_V13.md) · [멜로디 반복성](docs/MELODY_REPETITION_V14.md) · [베이스](docs/BASS_V15.md) · [크래시 심벌](docs/CRASH_V16.md)

## 라이선스

Copyright (C) 2026 Yakshawan. All rights reserved.

v0.9.0부터 자체 코드에는 [Kalavinka Proprietary License](LICENSE)를 적용합니다. 공식 웹앱의 무료 사용과 청취는 허용합니다. 코드의 재사용·수정·재배포·별도 호스팅·다른 제품이나 서비스로의 전용에는 별도 서면 허락이 필요합니다. 법령, GitHub 약관상 권한, 별도 라이선스에 따른 권리는 예외입니다.

이미 AGPL-3.0-or-later로 배포한 v0.8.0 및 이전 코드에 부여된 권한은 철회하지 않습니다. [마지막 AGPL 배포본](https://github.com/heavyrain39/kalavinka/tree/54cd8a16d6765179f6754547d4e75f3b21adcc2b)과 고지는 Git 기록에 보존합니다. 공개 저장소의 열람·포크와 자유로운 코드 재사용 허가는 서로 다릅니다.

폰트(OFL), Mastermind 유래 부분(MIT), 빌드 도구의 별도 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 `public/licenses/`에 보존합니다. 기존 오픈소스 부분까지 독점 라이선스로 제한한다고 주장하지 않습니다.

### 오디오와 자산

악기·드럼·잔향은 브라우저에서 합성하며 외부 음원 팩이나 샘플 다운로드를 사용하지 않습니다. 합성한 드럼 버퍼는 재생 중 재사용합니다. 폰트와 재사용한 코드 부분에는 위의 별도 고지가 적용됩니다.

현재 [LICENSE §3](LICENSE)의 제한은 소프트웨어와 관련 자료에 관한 것이며, 일반적인 청취를 제한하거나 앱에서 생성한 오디오의 소유권을 주장하는 조항이 아닙니다. 이것을 생성 음원의 모든 상업적 이용·재배포에 대한 권리 보장으로 해석하지 마세요. 앱은 녹음·파일 내보내기를 제공하지 않습니다. 코드·자산 사용 허락은 [Yakshawan](https://github.com/heavyrain39)에게 문의하세요.
