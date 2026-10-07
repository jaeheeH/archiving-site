# ARCH.B dashboard design QA — 2026-10-07

final result: passed

## Comparison evidence

- Source visual: `C:/Users/kadfg/AppData/Local/Temp/codex-clipboard-90d0b99d-5e43-47ab-950c-6fe7991231be.png` (2503 × 1277 pixels).
- Implementation: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-dashboard/dashboard-desktop.png` (2488 × 1269 pixels), local `/dashboard?days=5`.
- CSS viewport: 2503 × 1277. The document client width is 2488; the browser capture omits the scrollbar and a small bottom edge. Comparison aligned the top/content regions and excluded these outer edges; no 2× density scaling was involved.
- State: authenticated administrator, light theme, five-day period selected, tables collapsed, top of page.
- Source and implementation were opened together in the same comparison input at original resolution. The five KPI cards, 60/40 chart composition and three lower cards were compared together. Original-resolution labels and data values were readable; a separate focused raster crop was not required.
- Mobile: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-dashboard/dashboard-mobile.png`, 390 × 844 CSS viewport.
- Tablet: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-dashboard/dashboard-tablet.png`, 768 × 1024 CSS viewport.
- Analysis evidence: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-dashboard/dashboard-analysis.png`.

## Required fidelity surfaces

- **Typography:** Pretendard confirmed loaded in the browser. Bold dashboard title, medium KPI numbers and muted small labels follow the reference hierarchy. Korean mobile labels wrap by word; article titles truncate in the sortable-by-metric presentation without widening the page.
- **Layout and rhythm:** Five KPI cards, paired trend/bar panels and three summary panels. White 24px-radius cards, 16px gutters and full available dashboard width. Mobile uses two KPI columns and stacked chart/summary cards; tablet uses three KPI columns and one chart column.
- **Colors:** Light gray canvas, white cards, dark text, restrained gray labels, black registration line and blue publication/reader series. Existing sidebar design remains consistent with other ARCH.B admin pages.
- **Assets:** Existing ARCH.B wordmark/navigation and installed Lucide UI icons are retained. The reference requires no article/raster imagery. Charts draw actual numeric data with Canvas; bars/proportions are data visualizations, not substitute illustration assets.
- **Copy and data:** Marketplace metrics were intentionally replaced with ARCH.B news, publishing, readership, member roles and editorial quality metrics. Real data produces different chart shapes. Views are labeled as article records, not unique visitors; bookmarks/likes are current net totals. Saved publication-date semantics and limitations are documented in `docs/dashboard-analysis.md`.

## Comparison history and fixes

1. **P1 — inherited width/header styles:** Initial implementation inherited the shared 1440px centered body and 56px header, leaving excessive wide-screen whitespace and clipping the title. `dashboard-first.png` records that state. Scoped theme selectors now use the available content width and an automatic header height. The final desktop capture confirms five full-width cards and a visible complete heading.
2. **P2 — category mapping:** Initial statistics mapped `interior` while ARCH.B stores `interiors`. The metric now reuses the existing category dictionary. Live checks and the final screen show design/development/interiors at 4 each, editorials at 25, other at 0.
3. **P2 — narrow Korean label wrapping:** Mobile reader KPI split a Korean word mid-syllable. Word-preserving wrapping now keeps labels readable; the final mobile evidence shows the repaired label.
4. **P2 — keyboard access to scrolling tables:** Added labeled, focusable scroll regions for daily and article tables with visible focus outlines. On mobile, ArrowRight moved the article table to `scrollLeft = 40` within its 295px container while page overflow remained false.

## Interactions and verification

- Five-, seven- and thirty-day period navigation works; Enter activated period selection. The thirty-day data table contains 30 rows and uses the displayed period boundaries.
- Daily data tables expand/collapse natively; chart readouts use actual daily data.
- Full statistics link preserves the period and opens `/dashboard/analytics` with 15 article rows; main dashboard shows 5.
- News management, article review, public article and existing create/studio links are connected to existing routes.
- No browser console errors or warnings observed. No page overflow at 390, 768, 1280 and 2503 CSS widths.
- Production build, scoped ESLint, Korean-date/period/null/scoped-view assertions, anonymous access checks, live ARCH.B joins and existing news/archive smoke checks passed.
- Final change adds no package, DB schema, scheduler or external analytics provider. The production preview remains running.

## Remaining acceptable differences

- ARCH.B's existing 240px sidebar and product navigation replace the marketplace sidebar; account names and navigation retain their established admin presentation.
- Additional operational analysis and article reaction rows sit below the reference's three-card summary because the requested work includes analysis, not just the reference's marketplace totals.
- Actual data is sparse and includes a collection spike; no smooth sample values or invented visitor/conversion figures were substituted.

No actionable P0/P1/P2 findings remain.


## ARCH.B 전체 화면 디자인 통일 — 2026-10-07

This later request supersedes the blue accents and 24px dashboard card radii above. The news design is now the shared reference: white canvas, charcoal #242424, muted gray #6b6b6b, green #1a8917, Pretendard, 4px controls and 8px panels. Existing news/art/archive image panels retain their flat image treatment.

- Updated the existing palette, theme and shared site/admin stylesheet. Old orange account/gallery/modal accents use the common brand token. Admin blue/indigo accents and Canvas charts use the same green. Destructive red and warning states remain visible.
- My Page home/profile/activity/account use matching titles, white panels, neutral borders and green focus states. Disabled inputs remain visually distinct.
- Gallery list has persistent titles/tags and native keyboard-accessible detail links. Search parameters survive detail navigation and closing. Gallery detail is light; tablet/mobile stack image and details, desktop fits the image inside the available width.
- CMS, settings, statistics and sidebar share colors, title sizing, panel/control radii and ARCH.B branding. Existing account nickname and author identities are preserved.
- A tablet image clipping issue was found during screenshot QA and fixed by removing the fixed 68vw frame, adding min-width:0 and stacking below 1024px.
- Production build (227 pages), TypeScript and dashboard checks passed. Scoped ESLint reports no errors; existing hook dependency/image warnings remain. git diff --check passes.
- Browser checks: 390px gallery/account/dashboard, 768px activity/image detail, 1280px profile and 1440px news/gallery/CMS/dashboard/archives. No page overflow. Gallery search, Enter-to-open, close/filter restoration and green input focus verified. Final browser warning/error log was empty.
- Evidence: C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-unified/ (dashboard-desktop.png, contents-desktop.png, gallery-desktop.png, gallery-mobile.png, gallery-detail-tablet.png, mypage-desktop.png, activity-tablet.png, account-mobile.png).
- No database/account/content/scheduler changes were performed for this styling request. User-owned editing tabs and form values were left intact.


## 뉴스 수집·작성 통합 — 2026-10-07

- User authorized reactivating daily 09:00 Korea time. Created and verified ACTIVE thread automation `arch-b`, named ARCH.B 뉴스 수집·자동 작성; local CLI writes at most 15 private drafts per run. Computer/app availability is required for this local schedule.
- CMS now presents collection + automatic writing, processing of existing waiting items, waiting/writing/failure counts, review-ready drafts and per-article failure reasons. No automatic publication.
- Pipeline reuses the five RSS feeds, Gemini 3.8 Flash investigation/generation and strict editorial quality validator. Stores source/provenance, research and bounded retry state on existing news records without a schema migration.
- Optimistic updated_at conditions claim and complete work, protect concurrent edits, prevent duplicate processing and resume interrupted claims. Existing authors/IDs/images/counters and published/human drafts are preserved. Current role scopes are checked before writing.
- Live test on ARCH.B: 162 feed items checked, zero duplicate insertions; one existing waiting item became a private draft with 2,330 characters, five sections and five cited references. Author verified as the existing ARCH-B account; publication false. Review route: /dashboard/contents/news/50db8356-a6d4-4bc6-b4c8-fbd13322ed98/edit.
- Pipeline checks cover successful private storage, repeated runs, invalid output, failure/retry limits, missing key, interrupted claims, sub-admin exclusions and concurrent human edits. Anonymous collect/process/status returns 401. Scoped ESLint has zero errors; TypeScript/build/public news checks pass.
- Automated run configuration is persisted in the Codex app rather than embedded in application code. The old paused CreativeScope automation was not present in this host's automation directory.

## 로그인 화면 단순화 — 2026-10-07

- Source visual truth: user-annotated `/login` screenshot plus the matching unauthenticated capture `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-login-simple/before-desktop.png`.
- Implementation: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-login-simple/after-desktop.png`. Source and implementation were opened together at original resolution in the same comparison input; both are 1280 × 720 pixels and CSS viewport at 1× density. No crop or density normalization was needed.
- State: unauthenticated, light theme. A separate loopback origin displayed the login page without signing out the user's authenticated session. Provider authentication was not submitted.
- Intentional changes: remove the large promotional heading, two-column layout, English eyebrow and full-width footer. Use a centered 360px column with the existing ARCH.B wordmark, concise sign-in copy, equal provider buttons, legal links and home link.
- Fonts/typography: Pretendard remains loaded. Existing wordmark uses 28px, the title 24px, button labels 14px and supporting/legal copy 14px/12px. Long promotional copy no longer splits mid-word.
- Spacing/layout: 32px between the wordmark, title group and provider group; 12px between 48px-high buttons. Mobile preserves 24px side padding and naturally wraps the legal copy. No frame, shadow or decorative hero was added.
- Colors/tokens: shared white background, charcoal text, gray borders/muted copy and green keyboard focus. Buttons use the existing background/border/muted roles.
- Assets: retained text wordmark and installed Remixicon Google/Kakao provider icons; no generated or substitute illustration assets. Icons are aria-hidden and button names remain clean.
- Copy/content: concise Korean login instruction; Google/Kakao choices, terms, privacy and home remain available. Provider handlers, session checks and safe return-path behavior are unchanged.
- Focused raster crop was unnecessary: all labels and provider icons are readable in the original-resolution desktop comparison. Mobile focus screenshots confirm the shared green outline.
- Additional evidence: `after-mobile.png` at 390 × 844; `after-small-mobile.png` at 320 × 568; `after-tablet.png` at 768 × 1024. No horizontal overflow at any checked width; the 320px section fits inside the viewport. Temporary viewport overrides were reset.
- Keyboard navigation advances from the wordmark to Google and then Kakao, with a visible 2px focus outline. Browser warning/error log was empty. Scoped ESLint and production build (228 pages, including TypeScript) passed.
- Comparison history: the initial rendered simplification met the requested scoped changes with no actionable P0/P1/P2 finding; no corrective visual iteration was required. Full external OAuth sign-in was intentionally outside the visual verification scope.
- Live handoff: waited for the existing news-writing queue to report no active writer, restarted only the verified ARCH.B preview process and confirmed the new screen on port 3000 (`after-desktop-live.png`). The temporary 3001 preview was closed. The live news API also confirms the three domestic sources from the preceding request are now loaded.
- Follow-through on the preceding feed request: the first live API check revealed that its source list persisted across deployment in the ten-minute news cache. The shared news cache now includes the feed configuration in its key. The new configured-source regression check, public article/permission checks and rebuilt live API pass with all eight feeds; no content or author record was changed by this fix.

final result: passed

## 2026-10-07 뉴스 자동 작성의 서버 실행
- 수집 및 대기 자동 작성 API를 202 작업 접수 + Next.js after 실행으로 변경. 계정별 중복 실행을 차단하고, 재접속 후 상태 조회 및 진행 중 3초 간격 갱신을 확인.
- 실제 localhost:3000에서 15편 작업을 시작한 탭을 다른 페이지로 이동한 뒤 닫음. 새 탭에서 초안 2편 완료 및 다음 기사 작성 상태가 복원되는 것을 확인.
- 첫 결과의 기존 작성자, 미발행 상태, ready 상태, 5개 섹션 및 5개 참고자료를 ARCH.B DB 읽기 전용 검사로 확인.
- 파이프라인 검사(권한, 기존 글 보존, 품질, 실패 재시도, 작업 중복, 진행 집계, 인증 실패 중단), 비로그인 API 거부, ESLint, 빌드 통과. 모바일 390px에서 가로 넘침 없음.
- 로컬 컴퓨터와 Node 서버가 실행 중이어야 함. 서버 재시작 시 메모리의 작업 요약은 초기화되지만 저장된 DB 초안은 보존. 오전 9시 정기 실행은 기존 설정 유지.
- 화면: C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-news-background/after-tab-close.png

## 뉴스 상세 첨부 이미지 반영 — 2026-10-07

- Source visual truth: `C:/Users/kadfg/AppData/Local/Temp/codex-clipboard-8453110d-635b-478f-b3ff-9d85321337ce.png` (1427 × 1077). Implementation: `/news/read/news-0e3966ab0e04f00f57a1`, shared `app/blog/[slug]/BlogDetailClient.tsx` and `app/css/news.css`.
- Comparison normalization: removed only the source's 83px blank right margin to obtain a 1344 × 1077 content frame. Removed the implementation's existing 79px global navigation from its full-page capture; preserved the article's original scale and left position, with a white right pad for the scrollbar difference. No asset scaling, content replacement or left shift was used. Opened `final-comparison.png` and the focused `final-comparison-header.png` with source and implementation side by side.
- Typography: Pretendard, 40px/700 desktop title, 31px mobile title. Removed the old 880px title cap and 46px large-screen override so the reference title fits one line at the reference width. Category, author and reaction labels retain the existing hierarchy.
- Spacing/layout: desktop content is 864px main + 48px gap + 320px sidebar. The horizontal divider starts the two-column region; summary and sidebar begin 40px below it. Sidebar border stretches from the divider through the article. The centered thumbnail retains its native ratio, with maximum heights of 360px desktop/tablet and 240px mobile.
- Colors/tokens: white article header and canvas, existing charcoal text, gray border and #f7f7f5 summary surface. Green summary heading, bullets and sidebar labels reuse the shared theme.
- Assets: reused the existing article photo, ARCH-B account avatar and installed Remixicon icons. No new dependencies or replacement/generated imagery.
- Copy/content: retained the category, title, author/date/read time, summary, source caption, article body, references and related articles. Existing account/reaction handlers remain shared with editorials.
- Comparison history: corrected the P1 capped title/two-line header, P2 missing horizontal divider, P2 detached short sidebar border and P2 overly heavy title. The final full and focused comparisons show no remaining actionable P0/P1/P2 finding. Dynamic view counts differ from the supplied image according to the current article state; the existing global header is intentionally retained outside the supplied article crop.
- Responsive verification: actual 390 × 844 and 820 × 1180 viewports, one-column layout at both widths, no horizontal overflow; thumbnail heights 240px and 360px respectively. Viewed `mobile.jpg` and `tablet.jpg` at original resolution. Temporary viewport overrides were reset.
- Alternate content: viewed `no-image.jpg` (news-f833eccb65deeb7db0bf) and `editorial.jpg` (guksan-ai-bandoche-geomjeungeul-neomeo-seobiseuro-kperfga-ssoaolrin-sinho). The article without an image proceeds directly to the body; the editorial image preserves its landscape ratio at 360px maximum height. Both use the same sidebar/divider layout without page overflow.
- Interactions/accessibility: link copy displays its success state; Tab reaches the bookmark with a visible solid focus outline. No reaction was changed during visual QA. Browser error log was empty. Scoped ESLint has no errors (existing raw image warning remains), production build (228 routes) and diff whitespace check passed.
- Evidence directory: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-article-reference/`. `final-desktop.png` shows the top 1220px of the final live full-page capture at the restored default viewport, including navigation and the first body heading. Both localhost preview ports use the rebuilt implementation; the prior 15-item news job completed before the preview was restarted.

final result: passed

## 방문자 분석 — 2026-10-07

- Added public-page visitor collection, dashboard summary and `/dashboard/analytics/visitors`; reused existing white/charcoal/green dashboard panels, period controls, Canvas chart and native expandable data tables.
- Actual desktop 1280px and mobile 390 × 844 views fit without page overflow. Mobile has two KPI columns, stacked charts and the existing mobile sidebar control. Viewed `desktop.png`, `dashboard.png`, `mobile.jpg` and the populated API-check capture together. Period controls and one selected sidebar entry are consistent with the rest of the dashboard.
- Tested five-day navigation to completion (five data rows), thirty-day data (30 rows), and keyboard Enter to open the daily table. Confirmed the main dashboard's detail link preserves the selected period. Browser warning/error log was empty.
- The nonempty UI check used two temporary events created by the actual pageview API: one unique browser/visit, two page views, naver.com entry attribution, desktop device and news/art page ranking. Captured `populated-api-qa.jpg` for QA only; removed the temporary events afterward. Final screenshots reflect the real empty collection state, not fabricated traffic.
- ARCH.B project `overgjynkrnwayfammid` verified before applying the new table and service-only aggregate RPC. SQL rollback assertions passed for KST day boundaries, period versus daily uniqueness, sessions, previous same-time window, future exclusion, entry attribution, rankings, RLS and public grants. Live HTTP checks passed for duplicate IDs, cookie continuity, malformed/cross-origin requests, bot/DNT/GPC exclusion and four account roles; the temporary account and events were removed, verified zero remaining.
- Raw analytics and the aggregate RPC are inaccessible to anon/authenticated Data API roles. Application access requires administrator/sub-administrator profiles. The new table's no-policy advisory is an intentional service-only default denial with public grants revoked; existing unrelated Auth advisories were not changed.
- No original IP, account, query string or full referrer is stored. Local preview, private routes, hidden/prefetched tabs, bots and tracking preferences are excluded. New collection cannot restore past traffic; insufficient comparison history and zero-session averages are explicitly distinguished from calculated results. Privacy policy and README describe cookies, aggregation, retention and limits.
- Scoped lint and production build (229 routes) passed; only the pre-existing Sidebar dependency warning remains. Existing dashboard date/scope/missing-data checks pass. Both local preview ports use the rebuilt code; news writers were idle before restart. Temporary localhost-enabled verification server was stopped and viewport reset.
- Evidence: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-visitors/`. Remaining limitation: production visitors start collecting after deployment; browser counts depend on cookies and are not a count of individual people. No actionable layout or interaction issue remains.

final result: passed

## 콘텐츠 관리 페이지네이션 통일 — 2026-10-07

- News, art, artists, references, editorials and gallery now use the shared pagination component for numbers as well as navigation controls. All lists retain their existing filters, URLs and page sizes; one-page and empty results use the same layout.
- Desktop controls are 36px squares with charcoal selection, gray boundaries and green keyboard focus. First/last use double arrows; previous/next use single arrows. Unavailable controls are native disabled buttons, including link-based lists.
- Checked all six live lists, reference page 2 and gallery first/last navigation. News keyboard navigation to page 2 preserved the AI query, category and draft filter. The one-page artists list displayed four disabled boundaries and the selected page 1.
- At an actual 390 × 844 viewport, visible controls were 32px squares with adjacent page numbers and no page overflow. Viewed desktop and mobile captures; viewport override reset. Browser error log was empty.
- TypeScript, scoped ESLint, `npx tsx scripts/check-pagination.mjs`, production build (229 routes) and whitespace check passed. Both local preview servers were refreshed after confirming zero active news writers; temporary port 3002 was stopped.
- Evidence: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-pagination/`, including `final-artists.jpg`, `news-filtered-page2.jpg` and `mobile.jpg`.

final result: passed

## 검색엔진 노출 및 아트 이미지 — 2026-10-07

- Removed the artificial gray canvas, 16px image padding and hover zoom from art/artist cards. The masonry layout keeps each work's native ratio and complete image. Desktop and actual 390 × 844 captures show transparent media backgrounds, 0px padding and no page overflow.
- Public pages now have individual absolute canonicals, descriptions and sharing metadata. News categories have canonical landing URLs; search/filter variants are noindex/follow. Login, authentication, account, extension and dashboard screens use noindex metadata/headers; Vercel Preview has a global indexing block.
- Added escaped JSON-LD for the site/publisher, articles with the existing author and publication dates, artworks, artists, gallery images and breadcrumbs. Original article sources are cited. News/editorial text is present in the initial HTML; the read-only editor retains its interaction after hydration, with one rendered body and heading hierarchy preserved.
- Gallery list initial data matches the requested page, navigation has crawlable links, detail pages render HTML instead of a static Suspense shell, and invalid IDs/out-of-range pages return 404. Gallery media retains the existing visual layout.
- Sitemap contains 275 canonical URLs, published content only, real available revision dates and no invented gallery/list modification dates. Range reads avoid the default response cap; an empty range returned 200/zero rows. RSS and prior editorial 308 redirects remain valid. Site-setting saves invalidate metadata and robots cache immediately.
- `npx tsx scripts/check-seo.mjs http://localhost:3002` passed Googlebot/Yeti HTML, head canonicals, one H1, article/body schemas, safe JSON/content serialization, filters/private noindex, preview headers, sitemap/RSS, gallery page 2 data, redirects and missing-content responses. TypeScript, production build (229 routes), scoped lint (no errors, existing hook/image warnings plus fallback image warnings) and whitespace checks passed. Browser error log was empty.
- Both normal local ports were refreshed after checking zero active news writers. Temporary port 3002 was stopped and viewport override reset. No DB data or schema, scheduled writing or account verification was changed.
- Production completion remains external: deploy the code, add Google verification, complete/confirm console ownership and submit sitemap/RSS. Existing Naver verification is preserved, not claimed as confirmed. The production apex host currently returns a hosting-level 307 to www; set the primary domain redirect to 301/308 in hosting settings. README and the SEO dashboard show the registration steps.
- Evidence: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-seo/`: `final-art.jpg`, `final-seo-settings.jpg`, `art-mobile.jpg`.

final result: technical implementation and local verification passed; production deployment and console submission pending

## 라이트·다크 모드 — 2026-10-07

- Added the same accessible 44px sun/moon toggle to the public header, desktop/mobile dashboard and login. The initial mode follows the device preference; an explicit choice persists in local storage across reloads and navigation. Other tabs follow changes. The inline head initializer avoids a light flash before hydration, and switching works when browser storage is blocked.
- Reused the existing Balsa palette and archive roles for surfaces, text, fields, tables, pagination, actions and status colors. News/article/art styles no longer force a white canvas. Images and image overlays retain their original colors. Canvas charts redraw from the active palette when the mode changes. The existing browser theme-color setting is retained in light mode.
- Checked dashboard, news management, article summary/sidebar, art, artists, references, gallery, mypage and SEO settings in dark mode. Mobile 390px and tablet 768px had no page overflow; the visible dashboard toggle remained accessible, and Enter switched back to light mode. The chart axes, labels and both series were visible in dark mode. Browser errors: none.
- `npx tsx scripts/check-color-mode.mjs` checks first paint, device/manual choices, reload persistence, invalid preferences, blocked storage, browser chrome color and both palettes' text contrast. TypeScript, focused lint and the production build passed; archive, pagination, dashboard and SEO regression checks passed.
- Final compiled head-script checks passed on ports 3000 and 3001. Evidence: `C:/Users/kadfg/.codex/visualizations/2026/10/07/archb-color-modes/dashboard-light.png` and `dashboard-dark.png`. Restored the light preference after testing, reset the viewport and left the dashboard available.
