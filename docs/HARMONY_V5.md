# Kalavinka v0.8.0 — 화성·필인 v5

## 음악 규칙

- 세 분위기에 10개씩 총 30개의 진행을 배정합니다. 장조와 자연단음계의 코드톤을 사용하며, 같은 근음 순서의 단순 순환 이동은 중복으로 세지 않습니다.
- 각 진행은 7th·6th·add9·sus4를 곡 성격에 맞게 사용합니다. 화음 성부의 이동량과 음역을 함께 최소화하고 마지막→첫 코드 연결도 계산합니다.
- Warm desk와 일반 After hours는 코드당 2마디, Quiet space와 D&B는 4마디를 유지합니다. 따라서 D&B의 빠른 드럼에 화음까지 급하게 바뀌지 않습니다.
- 도입을 제외한 8/16마디 진행의 마지막 한 마디에서 68%의 결정적 확률로 별도 종결 코드를 사용합니다. 같은 시드·설정은 같은 결과를 만들며, 변화 0은 형태를 반복합니다. 열려 있는 모달 종결과 도미넌트 해결을 함께 사용합니다.
- 종결 코드가 시작될 때 화음을 새로 발음합니다. 이전 패드의 릴리스와 베이스 음 길이를 새 화성 경계 앞에 맞추고, 선율·베이스도 바뀐 코드에 맞춥니다. 화면의 코드명도 재생 마디에 따라 바뀝니다.
- 필인은 12가지 짧은 스네어·하이햇·림·탐 조합입니다. 8마디 경계에서만 후보가 되며, 도입·비움·비트 없는 구간·Quiet space·에너지 20 미만은 제외합니다. 후보의 확률은 에너지에 따라 30–60%이며 연속 경계에서 발생하지 않습니다.
- 필인은 마지막 1.5박 안에서 2–3개 타격으로 끝나며, 에너지 45 미만에서는 두 타격으로 줄입니다. 꼬리의 보조 하이햇은 비워 주고 킥 및 2·4박 스네어는 유지합니다. 탐·림도 브라우저에서 직접 합성합니다.

## 진행 목록

아래 표는 조성의 으뜸음을 C로 옮긴 표기입니다. 실제 재생은 시드에 따라 12개 조로 이동합니다. 마지막 열은 마지막 마디에서만 사용하는 대체 코드입니다.

| 분위기 | 이름 | 조성 | 기본 진행 | 마지막 마디 |
| --- | --- | --- | --- | --- |
| Warm desk | Sunday turnaround | 장조 | Cmaj7 → Am7 → Dm7 → G7sus4 | G7 |
| Warm desk | Window light | 장조 | C6 → Em7 → Fmaj7 → Dm7 | G7 |
| Warm desk | Soft landing | 장조 | Fmaj7 → Em7 → Dm7 → Cadd9 | C6 |
| Warm desk | Paper lantern | 장조 | Am7 → Em7 → Dm7 → G7sus4 | G7 |
| Warm desk | Late morning | 장조 | Cadd9 → F6 → Am7 → G7sus4 | G7 |
| Warm desk | Velvet minor | 단조 | Cmadd9 → Fm7 → B♭7sus4 → E♭maj7 | Gm7 |
| Warm desk | Falling leaves | 단조 | Cm7 → B♭add9 → A♭maj7 → Gm7 | Fm7 |
| Warm desk | Amber room | 단조 | A♭maj7 → Fm7 → Cmadd9 → E♭6 | B♭7sus4 |
| Warm desk | Quiet conversation | 단조 | Cm7 → E♭maj7 → B♭add9 → Fm7 | Gm7 |
| Warm desk | Blue notebook | 단조 | Fm7 → B♭7sus4 → E♭maj7 → A♭maj7 | Cm7 |
| Quiet space | Open horizon | 장조 | Cadd9 → Fmaj7 → C6 → Dm7 | F6 |
| Quiet space | Still water | 장조 | Cmaj7 → Dm7 → Fadd9 → C6 | G7sus4 |
| Quiet space | Cloud layers | 장조 | Fmaj7 → Cadd9 → Am7 → Em7 | C6 |
| Quiet space | Long afternoon | 장조 | C6 → Am7 → Em7 → G7sus4 | Dm7 |
| Quiet space | Floating shore | 장조 | Dm7 → Fadd9 → Cmaj7 → Am7 | G7sus4 |
| Quiet space | Distant glow | 장조 | Cmaj7 → Em7 → Am7 → F6 | G7sus4 |
| Quiet space | Slow tide | 장조 | Fadd9 → Dm7 → Am7 → Cmaj7 | C6 |
| Quiet space | Morning mist | 장조 | Cadd9 → G7sus4 → Dm7 → Fmaj7 | F6 |
| Quiet space | Moonlit water | 단조 | Cmadd9 → A♭maj7 → Fm7 → Cm7 | B♭7sus4 |
| Quiet space | Night garden | 단조 | E♭add9 → A♭maj7 → Cm7 → Fm7 | B♭7sus4 |
| After hours | Midnight descent | 단조 | Cm7 → A♭maj7 → B♭add9 → Gm7 | B♭7sus4 |
| After hours | Deep pulse | 단조 | Cmadd9 → Fm7 → Cm7 → B♭7sus4 | Gm7 |
| After hours | Neon steps | 단조 | Cm7 → E♭6 → B♭add9 → A♭maj7 | Gm7 |
| After hours | Afterglow | 단조 | A♭maj7 → E♭add9 → Gm7 → Cmadd9 | B♭7sus4 |
| After hours | Night transit | 단조 | Cm7 → Gm7 → A♭add9 → B♭7sus4 | Fm7 |
| After hours | Undercurrent | 단조 | Fm7 → Cmadd9 → A♭maj7 → B♭add9 | Cm7 |
| After hours | Low orbit | 단조 | Cmadd9 → A♭6 → E♭maj7 → Fm7 | B♭7sus4 |
| After hours | Side street | 단조 | Cm7 → B♭7sus4 → Fm7 → A♭maj7 | Gm7 |
| After hours | Warm signal | 장조 | Am7 → Fmaj7 → Dm7 → G7sus4 | Em7 |
| After hours | First train | 장조 | C6 → Dm7 → Em7 → Am7 | G7sus4 |

## 호환성·검증

- 새 음악은 생성기 v5를 사용합니다. 저장한 곡과 공유 링크의 v1–v4 규칙은 유지하며, v4 합주·베이스 구현은 별도 파일에 보존했습니다. 새 흐름·분위기·음색 변경은 v5로 전환합니다.
- 기존 27개 검증에 v4 악보 지문, 30종의 고유성·스케일 적합성, 50/180 BPM 및 D&B의 종결 경계, 필인의 빈도·다양성·킥/백비트 보존을 추가했습니다. 단위 검증 31개 통과.
- Chromium OfflineAudioContext로 4개 드럼 세트의 탐·림 8개 조합과 30종의 종결 4마디를 렌더링했습니다. 에너지·리버브·볼륨 100, 180 BPM 조건에서 혼합 출력 최대 샘플 피크 0.876 미만, 비정상 샘플 0, 종료 후 활성 소스 0. 이 수치는 렌더링 검증이며 전곡의 주관적 청취 평가를 뜻하지 않습니다.
- 브라우저 검증: 재생 16번째 마디에서 종결 코드 표시, 다음 주기에서 복귀, 재생 정지 후 소스 정리, v4 공유 로드와 새 흐름의 v5 전환.
- 이름은 Kalavinka · 가릉빈가. 헤더는 기본 영문, 호버/키보드 초점에서 한글로 전환하며 폭을 유지합니다. 기존 URL과 저장소 키를 유지합니다. 데스크탑 1440×900·1280×720과 모바일 390×844·320×700에서 가로 넘침을 확인합니다.

오디오 재현: 개발 서버를 켠 뒤 Playwright CLI의 run-code로 tests/browser/harmony.js를 실행합니다. 이 파일은 개발 서버의 모듈을 사용하는 검증 스크립트이며 배포 번들에 포함되지 않습니다.

## 생성기 v17 후속 · v0.25.0

v17(`src/harmony-v17.ts`)은 같은 시드에서 위 표의 기본 진행과 68% 종결 계획을 유지하면서 비움 구간의 보조 진행, 색채 치환, 1마디 접근 화음, 코드별 스케일, 반주 음역 하향을 더한다. v5–v16 저장곡은 이 문서의 규칙을 유지한다. [음악 기획서 v17](MUSIC_V17.md)
