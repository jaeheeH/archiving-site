# ARCH.B

디자인·AI·제품·개발·인테리어의 뉴스와 에디토리얼을 중심으로, 작품·작가·참고사이트를 함께 탐색하는 매체입니다.

현재 저장소에는 출처와 공개 이미지 이용 조건을 확인한 작품 220점과 작가 32명의 자료가 있습니다. 2026-10-12 작품 57점을 보강하고, 2026-10-13 새 작가 7명의 작품 35점, 빌헬름 함메르쇼이의 작품 5점, 카사트·사전트·뒤러·휘슬러·쇠라의 작품 25점, 기존 작가 27명의 작품 68점을 추가했습니다. 27명은 작가별 6–10점, 훌스동크·리피는 5점이며, 김시·이택균·Yeoseol은 추가 작품의 귀속과 이미지 이용 조건을 확인해야 하므로 현재 1점씩입니다.

## 프로젝트 기준

- 제품 방향: [`docs/project-plan.md`](docs/project-plan.md)
- 구현 순서와 완료 기준: [`docs/execution-plan.md`](docs/execution-plan.md)
- 수집·보존 운영: [`docs/art-archive-plan.md`](docs/art-archive-plan.md)
- 현재 작품 표본: [`research/art-collection/README.md`](research/art-collection/README.md)

메인 `/`는 뉴스 디자인을 사용합니다. `/news/stories`와 `/news/read/[slug]`에서 뉴스·기존 블로그 글을 함께 읽고, `/art`, `/artists`, `/references`는 보조 탐색 메뉴로 제공합니다. 기존 `/blog` 주소는 에디토리얼 목록·본문으로 영구 연결됩니다. `/gallery`는 생성 이미지 기록으로 유지합니다.

## 수익화와 공개 페이지 점검

`/ads.txt`는 사이트 설정의 `custom_scripts`에서 실제 사용 중인 AdSense `ca-pub-` ID를 읽어 생성합니다. 게시자 ID를 바꾸면 광고 코드와 ads.txt가 같은 설정을 따릅니다. 광고 설정이 없을 때는 404를 반환합니다.

GA4와 GTM이 모두 설정돼 있으면 GTM 컨테이너에서 GA4를 관리합니다. 직접 삽입한 GA4 로더를 중복 실행하지 않습니다. GTM을 사용하지 않는 사이트에서는 기존 GA4 ID로 직접 수집하며, 두 방식 모두 초기 화면이 표시된 뒤 로드합니다. 자체 읽기·검색·저장 분석은 별도로 유지합니다. 개인정보처리방침은 검색어 필터링과 Google 분석·광고 쿠키 사용을 설명합니다.

아트 목록은 페이지별 대표 URL을 사용하고 필터 검색의 검색 제외 설정을 유지합니다. 관련 글은 주제 태그와 제목·요약의 관련성을 우선하며, 같은 카테고리의 무관한 최신 글로 빈자리를 채우지 않습니다.

로컬 서버에서 확인할 수 있는 검증 명령:

```bash
node --experimental-strip-types scripts/check-monetization.mjs http://localhost:3000
```

원본 이미지가 계속 보이더라도 Vercel 최적화 요청이 `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`이면 프로젝트의 이미지 사용량·한도·요금제를 별도로 확인해야 합니다. 코드의 출처 허용 목록 수정만으로 플랫폼의 사용 한도가 해제되지는 않습니다.

## 로컬 실행

로컬 개발 서버는 Webpack으로 실행합니다. 현재 환경에서 반복된 Turbopack의 기본 모듈 읽기 오류를 피하기 위한 설정입니다.

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

## 참고사이트 등록

참고사이트는 [Chrome 확장 프로그램](extension/arch-b-reference-clipper/README.md)으로 등록할 수 있습니다. 페이지 정보와 캡처 이미지를 확인하고 관리자 범주를 최대 3개 선택해 저장합니다. 설치·계정 연결·검증 방법은 확장 프로그램 안내를 참고하세요.

## ARCH.B 뉴스

`/`는 주요 뉴스, `/news/stories`는 분야·키워드별 통합 목록, `/news/read/[slug]`는 가공 기사와 에디토리얼 본문입니다. `/news`는 메인으로 연결됩니다. 공통 헤더의 뉴스 메뉴는 기사 목록으로 연결하며 메인에서는 선택 표시를 하지 않습니다. 아트·작가·참고사이트는 보조 그룹으로 표시합니다. 검색은 헤더 하나에서 제공하고 분야·매체·주제 필터를 보존합니다.

가공 뉴스는 기존 Supabase `posts`에 `type = news`, `content.format = archb-news-v1`로 저장합니다. 원문은 비공개 초안으로 수집하고, 가공한 본문·핵심 요점·출처가 있는 기사만 공개합니다. 분석 문단은 ‘ARCH.B 분석’으로 구분합니다. 기존 작성 글은 `type = blog`와 Tiptap 본문·작성자·북마크를 보존하면서 통합 목록에서 에디토리얼로 표시합니다. CMS는 기존 편집 화면을 사용합니다.

국내 수집처로 [토스테크](https://toss.tech/), [당근 기술 블로그](https://medium.com/daangn), [여기어때 기술블로그](https://techblog.gccompany.co.kr/)의 공식 RSS를 함께 사용합니다. 국내 글도 같은 조사·작성·미발행 초안 흐름을 따릅니다. RSS 태그로 디자인·개발을 분류하고, 분야 태그가 없는 토스는 제목·요약·작성자 소개를 보완 근거로 사용합니다. 순수 조직문화·채용 태그 글은 제외하고, Medium의 RSS 추적값을 제거해 같은 글의 중복 수집을 막습니다.

수집처는 `lib/news-feeds.ts`의 23개 RSS/Atom을 공통으로 사용합니다. 기존 디자인·개발·공간 매체와 국내 기술 블로그에 Meta Engineering·Meta Newsroom·Google·Adobe Developers·Midjourney·삼성전자·Apple·Microsoft·NVIDIA·OpenAI·Hugging Face·Figma·Linear·Cloudflare·Chrome Developers를 추가했습니다. Adobe 일반 블로그가 안내하는 `/feed.xml`은 현재 404이므로 정상 확인한 공식 개발자 RSS를 사용합니다. 최근 90일의 매체별 최신 20편만 확인하며, 이전에 저장한 글은 삭제하지 않습니다. 원출처 주소로 중복을 막고 수집한 자료는 미발행 상태로 보존합니다.

AI와 제품·기술 분야를 추가했으며 RSS 제목·태그를 보고 기사의 주제로 분류합니다. 출처 수가 일일 작성 한도보다 많아도 최근 500회 작성 시도 기록에서 오래 처리하지 않은 매체를 먼저 선택합니다. 조사에서는 기업의 홍보 주장, 성능 측정 조건, 발표와 실제 출시, 지원 지역·요금·베타 여부를 구분합니다. 생성 후 사실 검수 요청으로 조사 메모와 본문을 대조하고, 분석에 숨은 단정·기술 혼동·과장도 확인합니다. 문제는 한 번만 수정·재검수하고 실패하면 기존 자료를 유지합니다. 주소를 확인하지 못한 검색 인용 링크와 동일 주소의 추적값·인코딩 대소문자 변형은 서로 다른 참고자료로 세지 않습니다. AI 검수는 편집자의 발행 전 검토를 대체하지 않습니다.

뉴스 작성은 Google Search Grounding을 사용하지 않습니다. 공개 원문을 읽고 관련 공식 자료 URL 후보를 최대 4개 제안한 다음 URL Context로 직접 열람합니다. 후보 주소만으로는 근거로 인정하지 않으며, 원문 포함 최소 2개를 실제로 읽고 공식 1차 자료를 인용해야 초안을 만듭니다. 열람 실패·로그인·유료벽·인증 URL은 우회하지 않고 근거가 부족하면 작성을 중단합니다. 조사 메모는 작성·검수 요청 동안에만 사용하며 반환하거나 저장하지 않습니다. 검색 결과·검색어·검색 제안 HTML도 수집하지 않습니다. 중복 비교에는 미발행 글의 편집 제목·요약과 인증 URL을 전송하지 않습니다. 참고: [Gemini API 약관](https://ai.google.dev/gemini-api/terms), [URL Context](https://ai.google.dev/gemini-api/docs/generate-content/url-context). 공개 접근 가능 여부가 원출처의 재사용 허가를 뜻하지 않으므로, 발행 전 출처 이용 조건과 내용·인용 권리를 편집자가 확인해야 합니다.

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

초기 기사 자료 12편은 `content/news/initial-articles.json`에 있고, 짧은 11편의 보강 초안은 `content/news/researched-articles.json`에 있습니다. 편집기에서 **보강 초안 검토 → 편집기로 가져오기 → 저장·발행** 순서로 적용합니다. 조사와 초안 열기는 현재 기사를 변경하지 않습니다. 발행은 본문 900~4,000자, 사실·분석을 구분한 3~8개 섹션, 원출처와 공식 1차 자료를 포함한 서로 다른 참고자료 2개 이상을 검증합니다. 기준에 못 맞춘 생성 결과는 같은 조사 자료로 한 번만 보정하며, 실패하면 기존 내용을 보존합니다.

발행 원고의 새 구성과 일괄 편집·검증 절차는 [뉴스 리뉴얼](docs/news-renewal.md)에 정리했습니다. 상단 요약으로 핵심 결론을 먼저 전하고, 본문은 배경·주제별 설명·짧은 정리·ARCH.B 의견으로 이어지며 출처는 하단에 모읍니다.

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

작성 완료된 본문과 발행 기사는 다시 쓰지 않습니다. `content.automation`에 처리 상태·시도 수·실패 원인을, `content.research`에 모델·조사 방식·확인 시각·출처 URL·검수 통과 여부만 보관합니다. 기사 작성 실패는 최소 1시간 뒤 새 배치에서 재시도하며 최대 3회 후 수동 검토로 남깁니다. `updated_at`·작성자 조건을 확인하여 중복 실행과 사용자 편집을 덮어쓰지 않습니다. ARCH.B 프로젝트 연결과 현재 작성 권한을 각 단계에서 다시 확인합니다. 기존 오전 9시 Codex 자동화는 같은 스크립트를 통해 DB 큐를 접수하고 완료까지 확인합니다.

서버에 접수만 하고 종료하려면 기존 실행 명령에 `--enqueue-only`를 추가합니다. 서버 재시작 후에도 남아 있는 DB 작업을 이어 처리합니다. 큐 검증: `npx tsx scripts/check-news-queue.mjs`, 파이프라인 검증: `npx tsx scripts/check-news-pipeline.mjs`. `supabase/tests/durable_news_jobs.sql`은 실제 DB에서 임대·복구·권한을 검사한 뒤 모두 롤백하는 테스트입니다.

## 작품·작가 관리와 DB

작품 30점의 짧은 소개는 소장 미술관 해설을 바탕으로 `research/art-collection/editorial.json`에 정리했습니다. 공개 상세의 ‘작품 이야기’, 작품 목록·통합 검색, CMS의 작품 소개 필드가 같은 `data.description`을 사용합니다. 작가 목록은 기존 출처가 있는 소개와 활동 분야를 함께 보여줍니다.

작가별 5점 보강 자료 57점은 `research/art-collection/expansion.json`, 출처의 작가 식별자·개별 이용 근거·원문 정보는 `expansion-sources.json`에 보존했습니다. 새 DB에서는 초기 자료를 넣은 뒤 `supabase/seed-art-expansion.sql`을 실행합니다. 이 보강 SQL은 기존 작품이나 작가 소개를 덮어쓰지 않고 작품·연결을 추가하며, 같은 ID에 다른 내용이 있으면 전체 작업을 중단합니다. 테이블이 없는 환경의 파일 기반 목록도 보강 자료를 함께 읽습니다.

2026-10-13에는 드가·피사로·고갱·르동·렘브란트·윈슬로 호머·베르트 모리조를 각각 5점씩 추가했습니다. 같은 보강 파일의 `artists`에는 새 작가의 소개·생몰년·출처를, `artworks`에는 추가 작품을 보존합니다. 새 DB에서는 앞선 시드 적용 후 `supabase/seed-art-expansion-2026-10-13.sql`을 실행합니다. 이 배치의 35점은 클리블랜드 미술관의 개별 CC0 표시, 작가 식별자, 이미지 실제 크기·해시를 검증했습니다.

빌헬름 함메르쇼이는 덴마크 국립미술관(SMK) 4점과 Met 1점으로 구성하며 `supabase/seed-art-hammershoi.sql`로 추가합니다. SMK의 Public Domain Mark 1.0과 Met의 CC0를 개별 표시 그대로 유지합니다. SMK의 원문 제목·구조화된 치수·작가 ID와 공개 이용 표시는 같은 출처 파일에 보존했습니다.

참고사이트 25곳의 한국어 소개·분류·확인 출처는 `content/references/editorial.json`에 기록했습니다. 2026-10-12 공식 페이지를 대조했고, 직접 조회가 제한된 Godly와 Studio Vanadium은 공식 도메인의 검색 색인으로 확인했다고 구분했습니다. 원자료와 DB 연결 검증은 `node scripts/check-content-quality.mjs`, 실제 공개 DB 검증은 `node --env-file=.env.local scripts/check-content-quality.mjs --live`로 실행합니다. 이후 CMS에서 편집한 내용은 배포용 초기 자료와 차이가 날 수 있으므로 이 검증은 기록한 보강 자료와의 일치 여부를 확인하는 용도입니다.

ARCH.B의 Supabase 프로젝트는 `overgjynkrnwayfammid`입니다. 적용한 스키마는 `supabase/migrations`, 기존 작품 30점·작가 19명과 출처를 보존한 초기 데이터는 `supabase/seed-art-catalog.sql`에 있습니다. 공개 목록·검색·상세와 CMS가 같은 `artworks`, `artists`, `artwork_artists`를 읽습니다. 콘텐츠 관리 순서는 뉴스 → 아트 → 작가 → 참고사이트 → 에디토리얼 → 갤러리입니다. 관리자·부관리자는 작품·작가를 추가·수정하고 에디터는 조회합니다. 이미지는 HTTPS URL로 등록합니다.

좋아요는 `post_likes`의 기사·계정 복합 키와 서비스 전용 RPC로 중복을 막고 원자적으로 집계합니다. 개인 조회는 본인 반응만 읽으며 클라이언트가 집계 수를 직접 변경할 수 없습니다.

## 검증

작품·작가 목록은 시대·사조·작품 종류·복수 주제와 소장처를 조합해 탐색합니다. 현재 220점의 분류와 출처는 `research/art-collection/taxonomy.json`, 기준과 편집 방식은 [작품 탐색 분류](docs/art-taxonomy.md)에 있습니다. 관리자에서 저장한 작품별 분류가 초기 파일보다 우선하며, 기존 DB 레코드를 일괄 변경하지 않습니다. `npx tsx scripts/check-art-taxonomy.ts`로 입력 검증과 분류·조합 조건을 확인하고, 뒤에 로컬 주소를 붙이면 실제 공개 화면도 검사합니다.

기존 작가별 추가 68점은 `supabase/seed-artworks-by-artist-2026-10-13.sql`에 있습니다. 앞선 시드를 순서대로 적용한 뒤 실행합니다. 새로운 작가 소개를 만들거나 기존 작품을 덮어쓰지 않고, 작품·작가 연결과 필요한 기관 식별자만 추가합니다. 작가별 수량과 선정 근거는 [수집 기록](research/art-collection/README.md)에 정리했습니다.

운영 대시보드 `/dashboard`는 콘텐츠 운영 집계를 제공합니다. 5·7·30일 기간은 한국 시간 기준이며, 뉴스 등록은 `created_at`, 기사 발행은 `published_at`, 기간 조회는 기존 `post_views` 기록을 사용합니다. 조회는 방문자 수와 다르며 기사별 24시간 중복을 제외한 기록입니다. 북마크·좋아요는 취소를 반영한 현재 누적 값으로 표시합니다. 직전 기간 비교는 같은 시각까지만 집계합니다. 관리자·부관리자는 기존 콘텐츠 권한 범위로 집계하고, 에디터는 본인 기사와 반응만 조회하며 회원 통계는 보이지 않습니다. `/dashboard/analytics`는 아래의 전체 방문·읽기·검색 분석을 사용합니다.

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

대시보드의 방문 요약과 `/dashboard/analytics/visitors`에서 7·30·90일 방문자, 방문 횟수, 페이지 조회, 방문당 조회, 일별 추이, 유입 도메인, 기기·섹션별 분포를 확인합니다. 방문 상세 기록은 하위 `/sessions`, 인기 페이지는 `/pages`에서 확인하며 페이지를 오갈 때 선택 기간을 유지합니다. 관리자·부관리자만 전체 공개 사이트의 집계를 조회합니다. 기사별 24시간 중복 제외 카운터와는 별도 지표입니다.

공개 페이지를 실제로 열거나 SPA로 이동할 때 `/api/analytics/pageview`에 한 번 전송합니다. 30일의 HttpOnly 쿠키로 브라우저를 구분하고, 방문 쿠키는 마지막 활동 후 30분에 만료됩니다. 임의 ID는 서버 HMAC으로 해시해 ARCH.B의 `site_page_views`에 저장합니다. 계정 ID와 전체 유입 URL·임의 쿼리 문자열은 저장하지 않습니다. 방문 시작의 외부 도메인과 허용된 UTM source/medium을 유입 경로에 사용합니다. 신뢰된 운영 요청의 IP·접속 환경은 방문 상세 기록에만 표시합니다. 봇, 추적 거부(DNT/GPC), 관리·로그인·마이페이지 및 기본 localhost 접속은 제외합니다. 새 방문 시작 시 180일이 지난 기록과 연결된 행동 이벤트를 정리합니다. 운영 권한 계정의 공개 사이트 방문은 새 기록부터 제외합니다.

새 수집이므로 과거 방문을 복원하지 않습니다. 직전 기간의 기록이 부족하면 증감률 대신 안내를 표시합니다. 일별 방문자 합계와 전체 기간 순방문자는 서로 다를 수 있습니다. 쿠키 차단·삭제와 브라우저 변경은 방문자 구분에 영향을 줍니다. 서비스 키를 교체하면 해시도 변경되어 새 방문자로 집계됩니다.

마이그레이션 `20261007092632_site_visitor_analytics.sql`은 ARCH.B에 적용했고 실제 마이그레이션 이력과 파일 버전을 맞췄습니다. 테이블은 RLS와 공개 권한 차단을 함께 적용하며, `SECURITY INVOKER` 집계 RPC는 서비스 역할만 실행합니다. DB가 직접 집계하므로 REST의 1,000행 제한에 영향을 받지 않습니다.

```bash
node --experimental-strip-types scripts/check-visitors.mjs http://localhost:3001
# 별도 테스트 서버에서만 localhost 수집을 임시 허용한 뒤 사용:
# ARCHB_ANALYTICS_TRACK_LOCALHOST=true npm run start -- -p 3002
node --env-file=.env.local --experimental-strip-types scripts/check-visitors.mjs http://localhost:3002 --live-write
```

실제 API 검사는 임시 방문 2건과 임시 계정 하나를 생성해 반복 요청, 쿠키 연속성, 익명 DB 접근 차단 및 권한별 화면 접근을 확인하고 생성한 데이터만 정리합니다. `supabase/tests/site_visitor_analytics.sql`은 한국 날짜 경계와 기간 내 중복 제외·세션·유입 집계를 검사한 뒤 롤백합니다. 운영 배포에서는 `ARCHB_ANALYTICS_TRACK_LOCALHOST`를 설정하지 않습니다.

## 통계와 읽기 깊이 분석

`/dashboard/analytics`는 방문·재방문·읽기·검색 반응 개요, `/dashboard/analytics/content`는 콘텐츠별 반응과 발행 후 첫 7일 기사 비교, `/dashboard/analytics/search`는 내부 검색어·결과 없음·검색 후 클릭·페이지 이동·기기별 경험·감지된 오류를 제공합니다. 모든 전체 분석은 관리자·부관리자만 조회합니다. 기존 방문 상세·인기 페이지 주소는 유지합니다.

`VisitorTracker`가 `/api/analytics/events`로 누적 활성 시간과 본문 최대 도달률을 전송합니다. 본문이 화면에 보이고 창에 포커스가 있을 때만 시간을 세며, 30초 이상 입력·스크롤이 없으면 멈춥니다. 바뀐 값만 최대 15초 간격과 페이지 이동·숨김 시점에 전송합니다. 깊게 본 조회는 활성 30초 및 본문 75% 이상, 끝부분 도달은 본문 90% 이상입니다. 읽기 이해도를 의미하지 않습니다. 새 기능 이전 기록의 NULL을 0초·0%로 치환하지 않습니다.

검색은 통합 검색·뉴스·아트·작가·참고사이트의 실제 결과 수와 연결합니다. 연락처·URL·인증정보 형태의 검색어는 제외합니다. 원문 URL의 쿼리, 오류 메시지·스택은 수집하지 않습니다. 저장은 성공 알림에 연결하며 조회별 같은 자료의 반복 저장을 중복 제외합니다. 외부 링크·다음 콘텐츠 클릭은 실제 페이지 이동 기록과 구분합니다. 이미지 오류는 원본 대체 로딩이 끝난 뒤에도 실패한 경우만 기록합니다.

`site_analytics_events`는 RLS와 공개 권한 차단을 적용하며 기록·집계 함수는 서비스 역할만 실행합니다. 조회 ID와 HMAC 방문자 값이 일치하는 경우만 기록하고, 누적 읽기 값은 역순 요청에도 감소하지 않습니다. 조회당 이벤트 상한과 서버 경과 시간 검증을 적용합니다. 90일 비교에 필요한 보관 기간은 180일입니다. 과거 데이터 부족과 새 지표 수집 시작일을 화면에 표시합니다.

```bash
npx tsx scripts/check-engagement.mjs
# 별도 QA 서버에만 ARCHB_ANALYTICS_TRACK_LOCALHOST=true 설정 후:
npx tsx --env-file=.env.local scripts/check-engagement.mjs http://localhost:3100 --live-write
```

ARCH.B에 적용한 마이그레이션은 `20261023014819_audience_engagement_analytics.sql`, `20261023020432_audience_conversion_coverage.sql`이며 실제 이력과 파일 버전을 맞췄습니다. DB 회귀 검사는 `supabase/tests/audience_engagement_analytics.sql`을 트랜잭션에서 실행한 뒤 롤백합니다. 실제 API 검사는 자신이 생성한 방문·임시 계정만 정리합니다.

## 검색 노출 운영

대표 도메인은 `NEXT_PUBLIC_SITE_URL`이며 기본값은 `https://www.archbehind.com`입니다. 공개 페이지마다 제목·설명·대표 URL·공유 정보를 생성합니다. 기사 작성자·발행일·수정일, 작품·작가·갤러리와 탐색 경로는 JSON-LD로 표시합니다. 뉴스·에디토리얼 본문과 갤러리 페이지별 데이터는 최초 HTML에 포함됩니다.

`/sitemap.xml`은 공개 목록, 분야별 뉴스, 작품·작가·갤러리와 발행된 기사만 포함하며 1시간마다 재생성됩니다. 실제 수정일이 없는 목록·갤러리는 lastmod를 생략합니다. 초안·검색·필터·관리·계정 화면은 색인 대상에서 제외하고 이전 `/blog/[slug]` 주소는 기사 주소로 308 이동합니다. Vercel Preview는 robots.txt·메타·응답 헤더로 색인을 차단합니다.

```bash
npx tsx scripts/check-seo.mjs http://localhost:3002
```

배포 후 `/dashboard/settings/seo`에서 구글·네이버 확인 값을 설정하고 각 콘솔에서 소유 확인을 완료합니다. 구글에는 `https://www.archbehind.com/sitemap.xml`, 네이버에는 같은 사이트맵과 `https://www.archbehind.com/rss.xml`을 제출합니다. 설정 화면의 ‘저장됨’은 확인 값을 저장했다는 뜻이며 콘솔 등록·색인 완료를 의미하지 않습니다. 기존 네이버 확인 값은 보존했고 구글 값은 아직 없습니다.

호스팅의 기본 도메인을 `www.archbehind.com`으로 지정하고 apex·HTTP 주소는 HTTPS 대표 주소로 영구 이동(301/308)하도록 설정합니다. 2026-10-07 확인 당시 apex→www는 호스팅에서 307로 응답하므로 배포 설정에서 변경해야 합니다. 도메인 변경 시 환경 변수, 콘솔 속성과 사이트맵 제출 주소를 함께 맞춥니다.

근거: [구글 대표 URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [기사 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/article), [사이트맵 수정일](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [네이버 선호 URL·로봇 메타](https://searchadvisor.naver.com/guide/markup-structure), [네이버 RSS·사이트맵 제출](https://searchadvisor.naver.com/guide/request-feed).
