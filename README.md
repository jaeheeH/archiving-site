# ARCH.B

디자인·개발·인테리어의 뉴스와 에디토리얼을 중심으로, 작품·작가·참고사이트를 함께 탐색하는 매체입니다.

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

## ARCH.B 뉴스

`/`는 주요 뉴스, `/news/stories`는 분야·키워드별 통합 목록, `/news/read/[slug]`는 가공 기사와 에디토리얼 본문입니다. `/news`는 메인으로 연결됩니다. 공통 헤더의 뉴스 메뉴는 기사 목록으로 연결하며 메인에서는 선택 표시를 하지 않습니다. 아트·작가·참고사이트는 보조 그룹으로 표시합니다. 검색은 헤더 하나에서 제공하고 분야·매체·주제 필터를 보존합니다.

가공 뉴스는 기존 Supabase `posts`에 `type = news`, `content.format = archb-news-v1`로 저장합니다. 원문은 비공개 초안으로 수집하고, 가공한 본문·핵심 요점·출처가 있는 기사만 공개합니다. 분석 문단은 ‘ARCH.B 분석’으로 구분합니다. 기존 작성 글은 `type = blog`와 Tiptap 본문·작성자·북마크를 보존하면서 통합 목록에서 에디토리얼로 표시합니다. CMS는 기존 편집 화면을 사용합니다.

- `GET /api/news`: 공개된 한국어 기사
- `POST /api/news/collect`: 지정된 RSS 매체를 비공개 초안으로 수집
- `GET /api/news/editorial`: 가공 대기 초안 20편
- `POST /api/news/editorial`: `{ articles: [...] }` 형식의 가공 기사 저장·공개
- `PATCH /api/news/[id]`: 담당 계정 권한으로 초안 저장·기사 발행
- `POST /api/news/[id]/research`: Gemini `gemini-3.8-flash`로 공식 자료를 조사하고 검토용 초안 반환
- `GET /api/news/[id]/research`: 준비된 보강 초안 반환
- `GET/PATCH /api/news/placement`: 관리자·부관리자의 대표 기사와 에디터 추천 지정
- `PUT /api/posts/[id]/like`: `{ liked: boolean }`으로 로그인 계정의 좋아요 추가·취소

수집과 가공 API는 기존 관리자·서브 관리자·에디터 로그인 권한을 확인합니다. 서버 키를 브라우저에 전달하지 않습니다. 예약 자동화는 꺼둔 상태이며, 이 통합은 스케줄러를 등록하지 않습니다.

초기 기사 자료 12편은 `content/news/initial-articles.json`에 있고, 짧은 11편의 보강 초안은 `content/news/researched-articles.json`에 있습니다. 편집기에서 **보강 초안 검토 → 편집기로 가져오기 → 저장·발행** 순서로 적용합니다. 조사와 초안 열기는 현재 기사를 변경하지 않습니다. 발행은 본문 1,800~3,000자, 사실·분석을 구분한 4~6개 섹션, 원출처와 공식 1차 자료를 포함한 서로 다른 참고자료 2개 이상을 검증합니다. 기준에 못 맞춘 생성 결과는 같은 조사 자료로 한 번만 보정하며, 실패하면 기존 내용을 보존합니다.

초기 자료를 가져올 때는 `npx tsx --env-file=.env.local scripts/import-news.mjs`를 실행합니다. 중복된 기존 기사와 작성자는 보존하며, 품질 기준을 충족하지 않은 원자료는 비공개로 가져옵니다. 편집 계정이 여러 개면 `ARCHB_NEWS_AUTHOR_ID`로 기존 계정을 지정합니다. 수동 초안 생성 CLI는 `npx tsx --env-file=.env.local scripts/research-news.mjs`이며 DB 저장 없이 검토 파일만 만듭니다.

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
