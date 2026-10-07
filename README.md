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

`/`는 주요 뉴스, `/news/stories`는 분야·키워드별 통합 목록, `/news/read/[slug]`는 가공 기사와 에디토리얼 본문입니다. `/news`는 메인으로 연결됩니다. 공통 헤더는 뉴스·모든 기사를 우선하고 아트·작가·참고사이트를 보조 그룹으로 표시합니다.

가공 뉴스는 기존 Supabase `posts`에 `type = news`, `content.format = archb-news-v1`로 저장합니다. 원문은 비공개 초안으로 수집하고, 가공한 본문·핵심 요점·출처가 있는 기사만 공개합니다. 분석 문단은 ‘ARCH.B 분석’으로 구분합니다. 기존 작성 글은 `type = blog`와 Tiptap 본문·작성자·북마크를 보존하면서 통합 목록에서 에디토리얼로 표시합니다. CMS는 기존 편집 화면을 사용합니다.

- `GET /api/news`: 공개된 한국어 기사
- `POST /api/news/collect`: 지정된 RSS 매체를 비공개 초안으로 수집
- `GET /api/news/editorial`: 가공 대기 초안 20편
- `POST /api/news/editorial`: `{ articles: [...] }` 형식의 가공 기사 저장·공개

수집과 가공 API는 기존 관리자·서브 관리자·에디터 로그인 권한을 확인합니다. 서버 키를 브라우저에 전달하지 않습니다. 예약 자동화는 꺼둔 상태이며, 이 통합은 스케줄러를 등록하지 않습니다.

초기 가공 기사 12편은 `content/news/initial-articles.json`에 있습니다. 로컬 환경 변수를 설정한 뒤 `node scripts/import-news.mjs`로 중복 없이 가져올 수 있습니다. 편집 계정이 여러 개면 `ARCHB_NEWS_AUTHOR_ID`로 기존 계정을 지정합니다. 검증은 `node scripts/check-news.mjs`를 실행합니다. 실행 중인 서버까지 확인하려면 `node scripts/check-news.mjs http://localhost:3000`을 사용합니다.
