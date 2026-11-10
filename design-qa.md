# Homepage design QA

final result: passed

## Final spacing and commit checks — 2026-11-10

- Artist archive heading: 24 px across desktop and mobile. Mobile artwork captions no longer reserve two lines; one-line titles shrink from 46.4 px to 23.2 px, with a 6 px gap before the artist. One- and two-line titles were checked at 599 and 320 px; desktop keeps its 18 px caption type.
- Evidence: `home-artist-title-24.jpg` and `home-artwork-mobile-caption-gap.jpg` in the evidence directory below.
- Integrated the UI changes on the latest remote master in an isolated worktree, preserving upstream image handling, article content styles and descriptive link labels. Type generation, TypeScript, targeted ESLint, homepage HTTP/link checks and whitespace checks passed on the combined code. Production build and physical-device checks were not run.

## Latest Artwork refinement — 2026-11-10

This pass supersedes the earlier fixed desktop image frames, purple palette, filled artist CTA and long Artwork introduction.

- PC artwork images now use their catalog dimensions and natural rendered heights in the existing two staggered flow columns. No square or 4:5 desktop frame remains. Measured examples range from 159 px to 845 px tall at a 341 px column width. Mobile ≤640 px retains the existing square cards in two horizontal rows.
- Each home request samples up to nine distinct works from the full preview-enabled catalog, without replacing or mutating catalog records. Two fresh HTTP renders each contained nine unique artwork destinations and produced different selections. Selection runs on the server; client hydration receives the same selected children. The nine thumbnails load eagerly at low priority to prepare newly sampled images before the section enters view.
- Artwork uses sage `#dce8df` with forest `#203b2d`, secondary text `#496351`, and a dark forest artist banner `#253b30`. Text contrast: title 9.65:1, introduction 5.23:1, artist text/link 9.53:1.
- The artist CTA is a transparent, underlined text link with a 44 px target. Its hover color remains readable against the banner. The Artwork introduction is shortened without a line clamp; at the user's 1125 px viewport it measures 91.78 px at a 30.6 px line height, approximately three lines. Korean words stay together when wrapping.
- [P2, fixed] A very tall natural-ratio work could leave its caption below the clipped keyboard viewport. Visible keyboard focus now scrolls the caption into view. All nine links passed with the tall-work cohort and again with the new random cohort.
- Checked at 1307 / 1125 px desktop and 560 / 390 / 320 px mobile. Desktop image boxes follow the image height; mobile rows remain horizontal and square. No page-wide overflow. All nine sampled images loaded in the inspected desktop state; browser console warnings/errors were absent.
- TypeScript, targeted ESLint, the home-route smoke check, repeated-request random-selection assertions and scoped whitespace checks passed. No new dependency or separate masonry controller was added.

Latest visual evidence in the directory listed below: `home-artwork-random-masonry-sage.jpg` (1125 px viewport, paused desktop flow) and `home-artwork-random-sage-mobile.jpg` (560 px viewport, keyboard-focused two-row flow). The renders were inspected for typography, word wrapping, image proportions, spacing, palette, caption placement, link affordance and responsive behavior. No actionable P0/P1/P2 findings remain. Physical phone gestures and a production build were not run in this pass.

## Latest spacing follow-up — 2026-11-10

- Removed the homepage-only 78 px gap before the footer: 48 px wrapper padding plus 30 px footer margin. The final reference section now meets the full-width footer border directly; the footer's internal padding remains intact.
- Topic columns use 48 px gaps on desktop and 32 px in the two-column layout. Category rows gain 16 px separation (8 px on mobile), heading-to-list spacing is 28 px (24 px on mobile), and article vertical padding is 24 px.
- Rendered checks passed at 1545, 900, 390 and 320 CSS px: footer gap is 0, responsive columns remain 3 / 2 / 1, and page width does not exceed the viewport. Scoped whitespace checks passed. No JavaScript changed in this follow-up.
- Evidence: `home-topic-spacing-expanded.jpg`, `home-topic-spacing-mobile.jpg` and `home-footer-gap-removed.jpg` in the evidence directory below. The desktop and mobile renders were visually inspected.

## Latest annotation pass — 2026-11-10

The latest user annotations supersede the earlier small Artwork heading, mobile vertical lane and visible pause buttons described in the baseline below.

- Artwork: 64 px above 768 px, 40 px at smaller widths. The introduction is expanded to 146 characters; the artist introduction is expanded to 161 characters. Artwork titles now sit in the copy below each image, with no image overlay.
- Desktop retains two opposing vertical lanes. At ≤640 px, the same nine artworks occupy two opposing horizontal rows. Checked at 560, 390 and 320 CSS px with no page-wide overflow.
- Visible motion buttons are removed from both sections. Reference cards support pointer dragging in both directions. Measured desktop drags moved the track −281.6 px and +230 px. Neither drag navigated or opened a tab; a subsequent ordinary click opened the expected Motion Examples page. The temporary external tab was closed.
- A focusable region supports Space to pause/resume without a visible button. Hover and link focus also stop motion; all nine artworks and all nine reference links remain reachable and visible by keyboard. Offscreen tracks were confirmed paused. Reduced-motion preference and document-visibility handling remain in place.
- [P2, fixed] The mobile media rule overrode the region's focus mask. The focus selector was made more specific; post-fix computed values are `mask-image: none` and a 2 px visible outline. `home-artwork-two-rows-mobile-560.jpg` is the post-fix capture.
- New browser-console warnings/errors: none. TypeScript, targeted ESLint, the updated home smoke check and scoped whitespace checks passed. No dependency was added.

Latest evidence in the directory listed below:

- `home-artwork-captions-desktop.jpg`: 1603 × 1244 CSS viewport, 1588 × 1232 exported pixels.
- `home-reference-draggable-desktop.jpg`: same viewport and exported size, no motion button.
- `home-artwork-two-rows-mobile-560.jpg`: 560 × 1244 CSS viewport, 545 × 1211 exported pixels, keyboard-focused and paused to inspect both rows.

The Design+ composition source and the updated desktop/mobile captures were opened together in one comparison input. Source capture is 1481 × 1244 CSS px; the latest desktop check uses the user's 1603 px context. This is a responsive composition comparison, not a same-viewport pixel match. Palette, authentic image assets, typography, copy, caption placement, spacing and focus state were reviewed. The source's image-title overlays are intentionally replaced by below-image titles per the latest request. No actionable P0/P1/P2 findings remain.

## Earlier baseline and comparison history

## Findings

No actionable P0/P1/P2 findings remain after the keyboard-navigation fix and the final source/render comparison.

## Visual targets and evidence

Implementation: `http://127.0.0.1:3001/`.

Evidence directory: `C:/Users/kadfg/.codex/visualizations/2026/11/09/01a1c2ac-09cb-7e23-bd18-c64d828c4d52/`.

Source visual truth:

- `reference-young-showcase.jpg`: Design+ Young: Showcase and Membership Y, selected by the user as composition references.
- `reference-sites-list.jpg`: the existing local `/references` page and its thumbnail → name → description cards.
- The user's latest annotations override the references: normal-size “Artwork” heading, artist introduction inside Artwork, black flowing references, and no home sidebar on mobile.

Rendered implementation:

- `home-artwork-flow-desktop.jpg`: full-color Artwork section, two moving lanes and the artist introduction banner.
- `home-reference-flow-desktop.jpg`: full-width black reference section with stacked card content.
- `home-topic-three-columns.jpg`: desktop category order and 3 × 2 grid.
- `home-mobile-news-457.jpg`: top stories followed directly by topics, with the home sidebar hidden.
- `home-artwork-flow-mobile-457.jpg`: single Artwork lane and stacked artist banner.
- `home-reference-flow-mobile-390.jpg`: mobile artist CTA and reference cards.
- `home-flow-keyboard.jpg`: post-fix visible keyboard navigation inside a scrollable lane.

The source and implementation desktop images were opened together in the same comparison input. The reference-list source and black reference implementation were also compared together in that input. Mobile screenshots and the keyboard screenshot were separately inspected as interaction/responsive evidence.

## Viewport, density and state

- Desktop source and implementation: 1481 × 1244 CSS px; both screenshot files are 1466 × 1231 pixels. The browser screenshot export uses the same scale for both. No resampling or pixel-perfect claim was used.
- Browser-reported device pixel ratio: 1.
- Mobile: 457 × 1244 CSS px exported as 442 × 1203 pixels; 390 × 1244 CSS px exported as 375 × 1196 pixels. These validate responsive behavior, rather than a mobile reference image match.
- Additional layout checks: 1024, 768 and 320 CSS px widths.
- State: light theme, logged out, real catalog artwork and reference-site content, running motion plus paused and keyboard-focused states. Source portfolio content is intentionally replaced by ARCH.B content.
- The full-view screenshots make the left text, artist banner, reference thumbnail/copy hierarchy and controls readable. No extra crop was needed; the keyboard-state screenshot supplies a focused interaction check without removing surrounding context.

## Required fidelity surfaces

- **Typography:** existing Pretendard retained. Artwork uses the normal section-title size, 25 px desktop / 23 px mobile, as requested. Category titles remain 600-weight and one line; existing article summaries remain limited to two lines. Reference names are 20 px / 600. App copy describes artwork, artists and references without importing Design+ membership or portfolio copy.
- **Spacing and layout:** full-bleed colored bands preserve the shared 1232 px inner container. At the desktop check, logo, first news-menu text and topic content all start at x = 117 px. Topics render 디자인 / 개발 / AI, then 제품·기술 / 인테리어 / 에디토리얼. They become two columns at ≤950 px and one at ≤640 px. Home sidebar hides at ≤768 px; this does not hide the news-list sidebar. Artwork uses two 620 px lanes on desktop and one 520 px lane at ≤640 px. The artist banner stacks on mobile, with a 44 px CTA.
- **Colors and tokens:** lilac Artwork with charcoal text; a charcoal artist banner with lilac copy; black references with light titles and muted descriptions. Measured text contrast ratios: Artwork title 7.58:1, intro 5.55:1, artist copy 7.30:1, reference title 16.12:1 and reference description 10.21:1. These local section tokens also preserve readable focus indicators.
- **Image quality:** real archive and reference thumbnails retained; no generated or code-drawn substitutes. Artwork uses contain to preserve the complete work, so letterboxing for wide or tall originals is intentional. Reference thumbnails use the same source images as the list page, cropped consistently above the name and description. Offscreen lazy images are expected to load as their cards enter view.
- **Copy and content:** nine distinct artwork links and nine actual reference sites. A separate artist-gallery block was removed; the text-only artist introduction now lives inside Artwork and links to `/artists`. Category subcopy is removed while article summaries remain.

## Comparison and fix history

1. **Blocked — P2 keyboard clipping.** Pausing a translated track alone left some focused original artworks outside the clipped window. One observed link occupied y = 368–768 while the flow window occupied y = 2004–2624.
2. **Fix.** A lane becomes static and manually scrollable while one of its links has visible keyboard focus. The edge mask is removed during keyboard exploration, and lane scroll resets when focus leaves. Other lanes pause. Visual loop copies remain hidden from assistive technology and have `tabIndex=-1`.
3. **Post-fix verification.** Assert-based browser checks reached all nine unique artwork links with their titles visible and all nine unique reference links inside their flow window. Leaving the artwork lanes reset both scroll offsets to zero and restored animation. `home-flow-keyboard.jpg` records the repaired state. The revised desktop capture was compared with the source again; no further P0/P1/P2 differences were found.

## Functional and responsive checks

- Pause freezes transforms; play restores movement. Artwork lanes move in opposite vertical directions and references move horizontally.
- Hover and visible link focus pause motion. Explicit pause/play controls work independently for the two sections.
- Artist CTA reached `/artists`; all-sites link reached `/references` in the browser.
- HTTP smoke check passed for the home page, `/artists` and the nine artwork destinations; duplicate artwork and reference-copy semantics were checked.
- No page-wide horizontal overflow at 1481, 1024, 768, 457, 390 or 320 CSS px widths. Mobile sidebar hiding and the settled one-lane layout were confirmed.
- A fresh reload and subsequent interactions produced no new browser console warnings or errors.
- TypeScript, targeted ESLint and scoped `git diff --check` passed.

## Residual gaps

- No physical-phone or production-build run in this pass.
- Reduced-motion preference handling was reviewed in source (initially paused, matchMedia listener and cleanup); changing the OS preference was not exercised in the browser.
- Existing unrelated analytics/server history was outside this visual change. No new console errors occurred during the final clean check.

## Implementation checklist

- [x] Requested content order and normal Artwork title.
- [x] Artist text introduction nested inside Artwork.
- [x] Full-color Artwork and black flowing references.
- [x] Desktop category grid and responsive/sidebar rules.
- [x] Visible keyboard navigation, loop-copy accessibility and motion controls.
- [x] Source/render comparison, screenshots and targeted checks.
