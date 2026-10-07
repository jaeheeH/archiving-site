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
