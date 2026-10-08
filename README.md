# ARCH.B

디자인·AI·제품·개발·인테리어의 뉴스와 에디토리얼을 중심으로, 작품·작가·참고사이트를 함께 탐색하는 매체입니다.

현재 저장소에는 The Met과 Cleveland Museum of Art에서 검증한 작품 30점과 확인 작가 19명의 표본이 있습니다. 이 표본은 화면과 데이터 구조를 검증하기 위한 것이며 첫 공개 목표 수량이 아닙니다.

## 프로젝트 기준

- 제품 방향: [`docs/project-plan.md`](docs/project-plan.md)
- 구현 순서와 완료 기준: [`docs/execution-plan.md`](docs/execution-plan.md)
- 수집·보존 운영: [`docs/art-archive-plan.md`](docs/art-archive-plan.md)
- 현재 작품 표본: [`research/art-collection/README.md`](research/art-collection/README.md)

메인 `/`는 뉴스 디자인을 사용합니다. `/news/stories`와 `/news/read/[slug]`에서 뉴스·기존 블로그 글을 함께 읽고, `/art`, `/artists`, `/references`는 보조 탐색 메뉴로 제공합니다. 기존 `/blog` 주소는 에디토리얼 목록·본문으로 영구 연결됩니다. `/gallery`는 생성 이미지 기록으로 유지합니다.

## 로컬 실행

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 운영 DB·스토리지·배포 설정은 실행 계획 A01에서 실제 환경을 확인한 뒤 확정합니다.

로컬에서 `npm run start`로 화면을 확인 중이라면 실행 중인 뉴스 작성이 완료된 것을 확인하고 서버를 종료한 뒤 `npm run build`를 실행하세요. 실행 중인 서버의 `.next`를 덮어쓰면 이전 탭이 참조하는 CSS·JavaScript가 사라질 수 있습니다. 빌드 완료 후 서버를 다시 시작합니다. 빌드마다 고유한 `deploymentId`를 생성하고 실행 서버는 생성된 `required-server-files.json`의 동일한 값을 사용합니다. 이전 탭이 새 서버로 이동하면 Next.js가 버전 차이를 감지하고 전체 페이지를 다시 받습니다. 배포 환경에서 `NEXT_DEPLOYMENT_ID`를 제공하면 그 값을 사용합니다.

## ARCH.B 뉴스

`/`는 주요 뉴스, `/news/stories`는 분야·키워드별 통합 목록, `/news/read/[slug]`는 가공 기사와 에디토리얼 본문입니다. `/news`는 메인으로 연결됩니다. 공통 헤더의 뉴스 메뉴는 기사 목록으로 연결하며 메인에서는 선택 표시를 하지 않습니다. 아트·작가·참고사이트는 보조 그룹으로 표시합니다. 검색은 헤더 하나에서 제공하고 분야·매체·주제 필터를 보존합니다.

가공 뉴스는 기존 Supabase `posts`에 `type = news`, `content.format = archb-news-v1`로 저장합니다. 원문은 비공개 초안으로 수집하고, 가공한 본문·핵심 요점·출처가 있는 기사만 공개합니다. 분석 문단은 ‘ARCH.B 분석’으로 구분합니다. 기존 작성 글은 `type = blog`와 Tiptap 본문·작성자·북마크를 보존하면서 통합 목록에서 에디토리얼로 표시합니다. CMS는 기존 편집 화면을 사용합니다.

국내 수집처로 [토스테크](https://toss.tech/), [당근 기술 블로그](https://medium.com/daangn), [여기어때 기술블로그](https://techblog.gccompany.co.kr/)의 공식 RSS를 함께 사용합니다. 국내 글도 같은 조사·작성·미발행 초안 흐름을 따릅니다. RSS 태그로 디자인·개발을 분류하고, 분야 태그가 없는 토스는 제목·요약·작성자 소개를 보완 근거로 사용합니다. 순수 조직문화·채용 태그 글은 제외하고, Medium의 RSS 추적값을 제거해 같은 글의 중복 수집을 막습니다.

수집처는 `lib/news-feeds.ts`의 23개 RSS/Atom을 공통으로 사용합니다. 기존 디자인·개발·공간 매체와 국내 기술 블로그에 Meta Engineering·Meta Newsroom·Google·Adobe Developers·Midjourney·삼성전자·Apple·Microsoft·NVIDIA·OpenAI·Hugging Face·Figma·Linear·Cloudflare·Chrome Developers를 추가했습니다. Adobe 일반 블로그가 안내하는 `/feed.xml`은 현재 404이므로 정상 확인한 공식 개발자 RSS를 사용합니다. 최근 90일의 매체별 최신 20편만 확인하며, 이전에 저장한 글은 삭제하지 않습니다. 원출처 주소로 중복을 막고 수집한 자료는 미발행 상태로 보존합니다.

AI와 제품·기술 분야를 추가했으며 RSS 제목·태그를 보고 기사의 주제로 분류합니다. 출처 수가 일일 작성 한도보다 많아도 최근 500회 작성 시도 기록에서 오래 처리하지 않은 매체를 먼저 선택합니다. 조사에서는 기업의 홍보 주장, 성능 측정 조건, 발표와 실제 출시, 지원 지역·요금·베타 여부를 구분합니다. 생성 후 사실 검수 요청으로 조사 메모와 본문을 대조하고, 분석에 숨은 단정·기술 혼동·과장도 확인합니다. 문제는 한 번만 수정·재검수하고 실패하면 기존 자료를 유지합니다. 주소를 확인하지 못한 검색 인용 링크와 동일 주소의 추적값·인코딩 대소문자 변형은 서로 다른 참고자료로 세지 않습니다. AI 검수는 편집자의 발행 전 검토를 대체하지 않습니다.

```bash
npx tsx scripts/check-news-sources.mjs
npx tsx scripts/check-news-sources.mjs --live
```

- `GET /api/news`: 공개된 한국어 기사
- `POST /api/news/collect`: RSS 수집과 최대 15편의 기사별 조사·초안 작성을 DB 작업 큐에 접수 (202)
- `GET /api/news/process`: 권한 범위의 대기·진행·실패 수와 DB에 저장된 본인 작업의 진행·완료 상태 (조회만 수행)
- `POST /api/news/process`: 대기 뉴스 최대 15편을 기사별 DB 큐에 접수 (202), 선택적으로 `{ limit: 1~15 }` 지정
- `POST /api/news/worker`: Supabase Cron의 전용 토큰으로 인증한 서버 호출만 접수 (202). 실행 한 번에 수집, 큐 선정 또는 기사 한 편만 처리합니다.
- `GET /api/news/editorial`: 가공 대기 초안 20편
- `POST /api/news/editorial`: `{ articles: [...] }` 형식의 가공 기사 저장·공개
- `PATCH /api/news/[id]`: 담당 계정 권한으로 초안 저장·기사 발행
- `POST /api/news/[id]/research`: Gemini `gemini-3.8-flash`로 공식 자료를 조사하고 검토용 초안 반환
- `GET /api/news/[id]/research`: 준비된 보강 초안 반환
- `GET/PATCH /api/news/placement`: 관리자·부관리자의 대표 기사와 에디터 추천 지정
- `PUT /api/posts/[id]/like`: `{ liked: boolean }`으로 로그인 계정의 좋아요 추가·취소

수집과 가공 API는 기존 관리자·서브 관리자·에디터 로그인 권한을 확인합니다. 서버 키를 브라우저에 전달하지 않습니다. 사용자 요청에 따라 매일 한국 시간 오전 9시에 Codex의 `ARCH.B 뉴스 수집·자동 작성` 정기 실행을 활성화했습니다. 수집부터 조사·작성까지 최대 15편씩 처리하고, 남은 대기는 다음 실행으로 이어집니다. 결과는 미발행 초안이며 검토 후 직접 발행합니다. 로컬 프로젝트 실행이므로 컴퓨터와 Codex 앱이 실행 중이어야 합니다.

초기 기사 자료 12편은 `content/news/initial-articles.json`에 있고, 짧은 11편의 보강 초안은 `content/news/researched-articles.json`에 있습니다. 편집기에서 **보강 초안 검토 → 편집기로 가져오기 → 저장·발행** 순서로 적용합니다. 조사와 초안 열기는 현재 기사를 변경하지 않습니다. 발행은 본문 1,800~3,000자, 사실·분석을 구분한 4~6개 섹션, 원출처와 공식 1차 자료를 포함한 서로 다른 참고자료 2개 이상을 검증합니다. 기준에 못 맞춘 생성 결과는 같은 조사 자료로 한 번만 보정하며, 실패하면 기존 내용을 보존합니다.

초기 자료를 가져올 때는 `npx tsx --env-file=.env.local scripts/import-news.mjs`를 실행합니다. 중복된 기존 기사와 작성자는 보존하며, 품질 기준을 충족하지 않은 원자료는 비공개로 가져옵니다. 편집 계정이 여러 개면 `ARCHB_NEWS_AUTHOR_ID`로 기존 계정을 지정합니다. 수동 초안 생성 CLI는 `npx tsx --env-file=.env.local scripts/research-news.mjs`이며 DB 저장 없이 검토 파일만 만듭니다.

### 자동 수집·작성 실행

```bash
# 기존 환경과 기존 작성자 계정으로 실행 (자동 발행하지 않음):
npx tsx --env-file=.env.local scripts/run-news-pipeline.mjs --author 9079a7b7-0641-436d-9b3d-c0e31b374e6f --limit 15
# 수집·AI 호출·저장 없이 연결과 대기 상태 확인:
npx tsx --env-file=.env.local scripts/run-news-pipeline.mjs --author 9079a7b7-0641-436d-9b3d-c0e31b374e6f --dry-run
npx tsx scripts/check-news-pipeline.mjs
npx tsx scripts/check-pagination.mjs
```

뉴스 관리의 **수집 + 자동 작성**은 수집부터 실행하고 **대기 뉴스 자동 작성**은 기존 대기만 처리합니다. 요청은 `news_jobs`에 저장하고, 수집 → 기사 선정 → 기사 한 편 작성으로 실행을 나눕니다. 각 API의 `maxDuration`은 300초이고 기사 조사·작성은 기존 180초 제한을 유지합니다. 다시 접속하면 저장된 상태를 조회하고, 실행 중에는 3초마다 초안 수·현재 기사·이번 큐의 남은 수를 갱신합니다. 계정별 실행 중인 작업은 DB 유일 제약으로 중복 접수하지 않습니다.

로컬 Node 서버는 `instrumentation.ts`에서 작업 소비를 시작하므로 브라우저를 닫아도 이어집니다. 컴퓨터와 서버는 켜져 있어야 합니다. Vercel 운영 배포에서는 Supabase Cron이 매분 대기 작업을 확인하고 `/api/news/worker`를 호출합니다. 큐가 비어 있거나 작업을 이미 선점한 동안에는 HTTP 호출하지 않습니다. 운영 서버에서 첫 수집·작성 요청을 접수할 때 `https://www.archbehind.com`의 작업 엔드포인트를 연결하며, 미리보기·localhost는 운영 연결을 바꾸지 않습니다. 새 코드를 Vercel에 재배포해야 클라우드 작업 소비가 동작합니다.

스케줄러 인증 토큰은 DB에서 생성해 Vault에 저장하고, 서버에는 해시만 제공합니다. 작업 테이블과 인증 설정은 RLS를 켜고 `anon`·`authenticated`의 직접 접근을 차단합니다. 작업 선점은 `FOR UPDATE SKIP LOCKED`와 10분 임대로 처리합니다. 임대가 만료되면 다음 서버가 이어 처리하며, 선점 토큰이 달라진 이전 서버는 진행 상태를 덮어쓸 수 없습니다. 같은 단계가 세 번 강제 중단되면 실패로 남깁니다. 기사 저장 뒤 진행 상태 저장 전에 중단된 경우 `content.automation.job_id`를 확인해 AI를 다시 호출하지 않고 완료 수를 복구합니다.

작성 완료된 본문과 발행 기사는 다시 쓰지 않습니다. `content.automation`에 처리 상태·시도 수·실패 원인을, `content.research`에 조사 근거를 보관합니다. 기사 작성 실패는 최소 1시간 뒤 새 배치에서 재시도하며 최대 3회 후 수동 검토로 남깁니다. `updated_at`·작성자 조건을 확인하여 중복 실행과 사용자 편집을 덮어쓰지 않습니다. ARCH.B 프로젝트 연결과 현재 작성 권한을 각 단계에서 다시 확인합니다. 기존 오전 9시 Codex 자동화는 같은 스크립트를 통해 DB 큐를 접수하고 완료까지 확인합니다.

서버에 접수만 하고 종료하려면 기존 실행 명령에 `--enqueue-only`를 추가합니다. 서버 재시작 후에도 남아 있는 DB 작업을 이어 처리합니다. 큐 검증: `npx tsx scripts/check-news-queue.mjs`, 파이프라인 검증: `npx tsx scripts/check-news-pipeline.mjs`. `supabase/tests/durable_news_jobs.sql`은 실제 DB에서 임대·복구·권한을 검사한 뒤 모두 롤백하는 테스트입니다.

## 작품·작가 관리와 DB

ARCH.B의 Supabase 프로젝트는 `overgjynkrnwayfammid`입니다. 적용한 스키마는 `supabase/migrations`, 기존 작품 30점·작가 19명과 출처를 보존한 초기 데이터는 `supabase/seed-art-catalog.sql`에 있습니다. 공개 목록·검색·상세와 CMS가 같은 `artworks`, `artists`, `artwork_artists`를 읽습니다. 콘텐츠 관리 순서는 뉴스 → 아트 → 작가 → 참고사이트 → 에디토리얼 → 갤러리입니다. 관리자·부관리자는 작품·작가를 추가·수정하고 에디터는 조회합니다. 이미지는 HTTPS URL로 등록합니다.

좋아요는 `post_likes`의 기사·계정 복합 키와 서비스 전용 RPC로 중복을 막고 원자적으로 집계합니다. 개인 조회는 본인 반응만 읽으며 클라이언트가 집계 수를 직접 변경할 수 없습니다.

## 검증

운영 대시보드 `/dashboard`와 통계 `/dashboard/analytics`는 같은 집계를 사용합니다. 5·7·30일 기간은 한국 시간 기준이며, 뉴스 등록은 `created_at`, 기사 발행은 `published_at`, 기간 조회는 기존 `post_views` 기록을 사용합니다. 조회는 방문자 수와 다르며 기사별 24시간 중복을 제외한 기록입니다. 북마크·좋아요는 취소를 반영한 현재 누적 값으로 표시합니다. 직전 기간 비교는 같은 시각까지만 집계합니다. 관리자·부관리자는 기존 콘텐츠 권한 범위로 집계하고, 에디터는 본인 기사와 반응만 조회하며 회원 통계는 보이지 않습니다.

운영 분석은 실제 가공 대기량, 발행 기사 품질 검증, 독자 반응에서 산출합니다. 조회 기록을 가져오지 못한 경우 0으로 표시하지 않고 집계 불가를 알립니다. 차트 아래 데이터 표에서 정확한 일별 값을 확인할 수 있습니다.

```bash
npm run build
npx tsx scripts/check-dashboard.mjs http://localhost:3000
# ARCH.B 실제 데이터에 읽기 전용 집계 검사를 실행할 때:
npx tsx --env-file=.env.local scripts/check-dashboard.mjs http://localhost:3000 --live
npx tsx scripts/check-news.mjs http://localhost:3000
node scripts/check-archive.mjs http://localhost:3000
npx tsx --env-file=.env.local scripts/check-archb-completion.mjs http://localhost:3000 --live
# 실제 Gemini 요청과 저장 전 보존까지 확인할 때만 추가:
npx tsx --env-file=.env.local scripts/check-archb-completion.mjs http://localhost:3000 --live --research
```

`--live`는 ARCH.B 주소를 확인한 뒤 임시 계정과 레코드로 권한·좋아요·발행·연결·캐시를 검증하며 종료 시 생성한 데이터만 정리합니다. DB 단위 검사는 `supabase/tests/archb_completion.sql`을 사용하며 반응 변경을 롤백합니다.

## 방문자 분석

대시보드의 방문 요약과 `/dashboard/analytics/visitors`에서 5·7·30일 방문자, 방문 횟수, 페이지 조회, 방문당 조회, 일별 추이, 유입 도메인, 기기·섹션별 분포와 인기 페이지를 확인합니다. 관리자·부관리자만 전체 공개 사이트의 집계를 조회합니다. 기사별 24시간 중복 제외 카운터와는 별도 지표입니다.

공개 페이지를 실제로 열거나 SPA로 이동할 때 `/api/analytics/pageview`에 한 번 전송합니다. 30일의 HttpOnly 쿠키로 브라우저를 구분하고, 방문 쿠키는 마지막 활동 후 30분에 만료됩니다. 임의 ID는 서버 HMAC으로 해시해 ARCH.B의 `site_page_views`에 저장합니다. IP, 계정 정보, 검색어, 쿼리 문자열과 전체 유입 URL은 저장하지 않습니다. 방문 시작의 외부 도메인만 유입 경로에 사용합니다. 봇, 추적 거부(DNT/GPC), 관리·로그인·마이페이지 및 기본 localhost 접속은 제외합니다. 새 방문 시작 시 90일이 지난 기록을 정리합니다.

새 수집이므로 과거 방문을 복원하지 않습니다. 직전 기간의 기록이 부족하면 증감률 대신 안내를 표시합니다. 일별 방문자 합계와 전체 기간 순방문자는 서로 다를 수 있습니다. 쿠키 차단·삭제와 브라우저 변경은 방문자 구분에 영향을 줍니다. 서비스 키를 교체하면 해시도 변경되어 새 방문자로 집계됩니다.

마이그레이션 `20261007092632_site_visitor_analytics.sql`은 ARCH.B에 적용했고 실제 마이그레이션 이력과 파일 버전을 맞췄습니다. 테이블은 RLS와 공개 권한 차단을 함께 적용하며, `SECURITY INVOKER` 집계 RPC는 서비스 역할만 실행합니다. DB가 직접 집계하므로 REST의 1,000행 제한에 영향을 받지 않습니다.

```bash
node --experimental-strip-types scripts/check-visitors.mjs http://localhost:3001
# 별도 테스트 서버에서만 localhost 수집을 임시 허용한 뒤 사용:
# ARCHB_ANALYTICS_TRACK_LOCALHOST=true npm run start -- -p 3002
node --env-file=.env.local --experimental-strip-types scripts/check-visitors.mjs http://localhost:3002 --live-write
```

실제 API 검사는 임시 방문 2건과 임시 계정 하나를 생성해 반복 요청, 쿠키 연속성, 익명 DB 접근 차단 및 권한별 화면 접근을 확인하고 생성한 데이터만 정리합니다. `supabase/tests/site_visitor_analytics.sql`은 한국 날짜 경계와 기간 내 중복 제외·세션·유입 집계를 검사한 뒤 롤백합니다. 운영 배포에서는 `ARCHB_ANALYTICS_TRACK_LOCALHOST`를 설정하지 않습니다.

## 검색 노출 운영

대표 도메인은 `NEXT_PUBLIC_SITE_URL`이며 기본값은 `https://www.archbehind.com`입니다. 공개 페이지마다 제목·설명·대표 URL·공유 정보를 생성합니다. 기사 작성자·발행일·수정일, 작품·작가·갤러리와 탐색 경로는 JSON-LD로 표시합니다. 뉴스·에디토리얼 본문과 갤러리 페이지별 데이터는 최초 HTML에 포함됩니다.

`/sitemap.xml`은 공개 목록, 분야별 뉴스, 작품·작가·갤러리와 발행된 기사만 포함하며 1시간마다 재생성됩니다. 실제 수정일이 없는 목록·갤러리는 lastmod를 생략합니다. 초안·검색·필터·관리·계정 화면은 색인 대상에서 제외하고 이전 `/blog/[slug]` 주소는 기사 주소로 308 이동합니다. Vercel Preview는 robots.txt·메타·응답 헤더로 색인을 차단합니다.

```bash
npx tsx scripts/check-seo.mjs http://localhost:3002
```

배포 후 `/dashboard/settings/seo`에서 구글·네이버 확인 값을 설정하고 각 콘솔에서 소유 확인을 완료합니다. 구글에는 `https://www.archbehind.com/sitemap.xml`, 네이버에는 같은 사이트맵과 `https://www.archbehind.com/rss.xml`을 제출합니다. 설정 화면의 ‘저장됨’은 확인 값을 저장했다는 뜻이며 콘솔 등록·색인 완료를 의미하지 않습니다. 기존 네이버 확인 값은 보존했고 구글 값은 아직 없습니다.

호스팅의 기본 도메인을 `www.archbehind.com`으로 지정하고 apex·HTTP 주소는 HTTPS 대표 주소로 영구 이동(301/308)하도록 설정합니다. 2026-10-07 확인 당시 apex→www는 호스팅에서 307로 응답하므로 배포 설정에서 변경해야 합니다. 도메인 변경 시 환경 변수, 콘솔 속성과 사이트맵 제출 주소를 함께 맞춥니다.

근거: [구글 대표 URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [기사 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/article), [사이트맵 수정일](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [네이버 선호 URL·로봇 메타](https://searchadvisor.naver.com/guide/markup-structure), [네이버 RSS·사이트맵 제출](https://searchadvisor.naver.com/guide/request-feed).
