# ISR 사용량 최적화 — 2026-11-09

Vercel Hobby 사용량 조사에서는 Fluid Active CPU 한도 초과로 팀이 중지됐고, ISR 쓰기·원본 전송·이미지 변환도 한도를 초과했다. 이후 사용자가 Pro로 전환했다. 이 변경은 최신 `origin/master`의 이미지 처리와 기사 콘텐츠 기능 위에 적용하며 결제 설정은 변경하지 않는다.

## 적용한 변경

- 기사 상세는 요청마다 렌더링하는 대신 최초 방문 시 생성하고 1시간 동안 ISR 결과를 재사용한다. 발행·수정·비공개·삭제의 기존 태그·경로 무효화와 클라이언트 로그인·저장 상태 처리는 유지한다.
- 작품 카탈로그와 사이트 설정의 시간 기반 캐시를 24시간으로 맞춘다. 관리자 저장의 기존 태그·경로 무효화는 유지한다. 뉴스 요약은 1시간 동안 재사용한다.
- 카탈로그·뉴스 요약·사이트 설정은 React `cache`로 같은 요청 안의 중복 조회를 줄인다. 사이트 설정의 일시적인 DB 오류는 데이터 캐시 밖으로 전파하고 요청 단위 기본값을 사용해, 빈 설정이 하루 동안 저장되는 일을 막는다.
- 좋아요·스크랩은 숫자를 제공하는 홈·글 목록 데이터의 `public-post-counts` 태그만 무효화한다. 기사 본문·뉴스 요약의 캐시는 유지하며 상세의 최신 저장 수는 기존 비공개 상태 API로 조회한다. 콘텐츠 변경에 쓰는 기존 태그는 유지한다.
- 작품·작가·갤러리 카드, 작품 태그, 뉴스 분야·주제와 페이지 이동 링크의 자동 미리 요청을 줄인다. 클릭 탐색과 검색은 유지한다.
- 작품·작가 목록의 이미지 `sizes`를 실제 4단 레이아웃에 맞춘다. 관련 작품의 3단 기본 크기와 기존 홈 WebP 제공은 유지한다. 같은 주소를 덮어쓰는 아바타가 있어 전역 이미지 캐시 기간은 기존 1일을 유지한다.
- 홈·뉴스 목록은 날짜 형식기를 재사용하고, 뉴스 목록은 페이지에서 계산한 필터·페이지 결과를 다시 계산하지 않는다. 홈·뉴스 목록의 동적 렌더링과 배너 일정 처리는 유지한다.
- 로컬 검증 서버에서는 `ARCHB_DISABLE_LOCAL_NEWS_WORKER=1`로 뉴스 작업 소비를 끌 수 있다. Vercel의 기존 작업 실행 방식은 유지한다.

## 검증 방법

```powershell
node scripts/check-site-settings-cache.mjs
node scripts/check-interaction-cache.mjs
node scripts/check-news-thumbnails.mjs
node scripts/check-news-delete.mjs
node scripts/check-seo-discovery.mjs
npx --no-install tsx scripts/check-performance.mjs
$env:ARCHB_BUILD_DIR = '.next-performance/isr-release'
$env:ARCHB_DISABLE_LOCAL_NEWS_WORKER = '1'
npm run build
npm run start -- --hostname 127.0.0.1 --port 3114
# 별도 터미널에서 같은 작업 폴더를 사용한다.
node scripts/check-hosting-cache.mjs http://127.0.0.1:3114 .next-performance/isr-release
node scripts/check-home-sidebar.mjs http://127.0.0.1:3114
```

사이트 설정·상호작용 검사는 모의 DB 요청으로 오류·복구와 기존 인증·입력 검증을 확인한다. 운영 모드 검사는 기사 재방문의 `HIT`·1시간 캐시·404, 작품 상세 전체의 24시간 재생성 간격과 실제 `HIT`, 목록 이미지 크기, 뉴스 분야·2페이지·빈 검색 결과의 API 일치와 홈을 확인한다. 실제 콘텐츠 쓰기나 관리자 저장은 실행하지 않는다.

최신 원격 코드에 반영한 프로덕션 빌드, 변경 파일 ESLint와 위 검사를 모두 통과했다. 검증 시 작품 상세 497개의 24시간 갱신 주기와 기사 재방문 `HIT`를 확인했다(최초 생성 439ms, 재방문 11ms). 이 시간은 로컬 단일 측정이며 실제 비용 절감률을 뜻하지 않는다. 원래 작업 폴더의 다른 변경과 스테이징 상태는 보존했다.

## 운영상 한계

직접 SQL이나 외부 스크립트로 작품·사이트 설정을 바꾸면 관리자 API의 무효화가 실행되지 않는다. 인증된 갱신 경로를 사용하거나 24시간 경과 후 재검증될 때까지 표시가 늦어질 수 있다. 작가 페이지는 관련 뉴스 데이터의 더 짧은 갱신 주기가 적용될 수 있다.

캐시 주기 감소 비율은 실제 비용 절감률과 다르다. 배포 후 같은 기간의 ISR·CPU·전송량을 비교해야 한다. [ISR 과금 안내](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing)의 읽기·쓰기는 8KB 단위이므로 쓰기 단위를 페이지 생성 횟수로 해석하지 않는다.

Pro 기본 요금을 유지해도 이 코드만으로 추가 요금 0원을 보장할 수 없다. [Spend Management](https://vercel.com/docs/spend-management)와 [CLI 예산 설정](https://vercel.com/docs/cli/budgets#vercel-billing-budgets-set)의 최소 예산 및 일시 중지 지연을 고려해야 한다. 이번 커밋은 과금 차단 설정을 추가하지 않는다.
