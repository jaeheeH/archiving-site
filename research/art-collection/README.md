# 실제 작품 수집 01

## 기존 작가 27명·작품 68점 보강 — 2026-10-13

현재 작품 220점·작가 32명입니다. 새 작가를 만들지 않고 기존 작가의 소장작을 보강했습니다. 클리블랜드 51점·메트로폴리탄 5점·미국 국립미술관 9점은 개별 공개 이미지 이용 표시를, 덴마크 국립미술관 3점은 PDM 1.0을 확인했습니다. 실제 JPEG 크기·바이트·SHA-256을 확인하고 기존 작품 및 이번 배치의 중복 이미지를 제외했습니다. 원문 제목·추정 연대·재료·액자 포함 치수는 보존하고 한글 제목·재료·작품 소개·분류를 추가했습니다.

| 작가 | 추가 | 현재 작품 |
| --- | ---: | ---: |
| 가쓰시카 호쿠사이 | 5 | 10 |
| 귀스타브 쿠르베 | 3 | 8 |
| 빈센트 반 고흐 | 3 | 8 |
| 에두아르 마네 | 3 | 8 |
| 사카이 호이쓰 | 1 | 6 |
| 윌리엄 메릿 체이스 | 1 | 6 |
| 윌리엄 터너 | 1 | 6 |
| 우타가와 히로시게 | 3 | 8 |
| 자크 루이 다비드 | 3 | 8 |
| 폴 세잔 | 3 | 8 |
| 피에르 오귀스트 르누아르 | 3 | 8 |
| 에드가 드가 | 3 | 8 |
| 카미유 피사로 | 3 | 8 |
| 폴 고갱 | 3 | 8 |
| 렘브란트 판 레인 | 3 | 8 |
| 오딜롱 르동 | 3 | 8 |
| 베르트 모리조 | 1 | 6 |
| 윈슬로 호머 | 3 | 8 |
| 제임스 맥닐 휘슬러 | 3 | 8 |
| 알브레히트 뒤러 | 3 | 8 |
| 메리 카사트 | 3 | 8 |
| 조르주 쇠라 | 1 | 6 |
| 빌헬름 함메르쇼이 | 3 | 8 |
| 요하네스 베르메르 | 2 | 7 |
| 클로드 모네 | 2 | 7 |
| 존 싱어 사전트 | 2 | 7 |
| 프레더릭 에드윈 처치 | 1 | 6 |

카사트의 양면 드로잉은 앞·뒷면을 한 작품으로 셌습니다. 작품을 대신하는 화집 표지와 같은 제목의 추가 인쇄본, 작가를 모방한 귀속 기록은 선정에서 제외했습니다. 미술관 해설이 없는 작품의 소개는 소장 기록과 이미지 관찰에 근거하며, `description_basis`로 구별합니다. 김시·이택균·Yeoseol과 훌스동크·리피는 이번 검증 자료에서 추가 소장작을 확보하지 못해 기존 수량을 유지합니다.

[작품 데이터](expansion.json)·[개별 원자료](expansion-sources.json)·[분류](taxonomy.json)·[기존 작가 보강 SQL](../../supabase/seed-artworks-by-artist-2026-10-13.sql)에 기록했습니다. SQL은 기존 작품·소개를 보호하고 새 작품과 작가 연결을 추가합니다. 미국 국립미술관의 베르메르·모네·사전트·처치 작가 식별자는 기존 기관 식별자를 유지하면서 덧붙입니다.

## 새 작가 5명·작품 25점 추가 — 2026-10-13 두 번째 확장

이 확장 완료 시점의 수량은 작품 152점·확인 작가 32명입니다. 메리 카사트·존 싱어 사전트·알브레히트 뒤러·제임스 맥닐 휘슬러·조르주 쇠라를 각각 5점씩 추가했습니다. 29명은 작가별 최소 5점이며, 기존의 세 작가에 대한 자료 부족 예외는 유지합니다.

클리블랜드 미술관 19점, 메트로폴리탄 미술관 3점, 미국 국립미술관 3점입니다. 개별 공개 이미지와 CC0 표시를 확인했고, JPEG 응답·실제 해상도·SHA-256을 검증했습니다. 공개 이미지가 없는 Met의 카사트 작품과 접근할 수 없는 Chicago 이미지 주소는 채택하지 않았습니다. 미국 국립미술관의 《파란 안락의자의 소녀》·《뱃놀이》·《해변에서 노는 아이들》로 카사트의 회화를 보완했습니다.

사전트의 기관 식별자 `cma:2559`와 `cma:287402`는 공식 소장품의 이름·생몰년과 작가 해설을 대조해 연결했으며 두 식별자를 보존합니다. 사전트의 병사 연구와 휘슬러의 여성 드로잉은 앞뒷면을 함께 보여 주는 한 장으로 각각 한 점만 셉니다. 《파란 안락의자의 소녀》는 NGA의 카사트 귀속과 배경 구성에 대한 드가의 도움을 함께 소개에 기록했습니다. 해설이 없는 초상·정물은 소장품 정보와 이미지 관찰로 소개하고 역사적 의미를 추측하지 않았습니다.

한글 제목은 작업용 번역입니다. 원문 제목·추정 연대·재료·액자와 매트를 포함한 cm 치수를 보존했고, 작품별 시대·종류·복수 주제와 확인 가능한 사조를 함께 정리했습니다. 초기 쇠라 풍경과 휘슬러의 전체 작품에 사조를 일괄 상속하지 않았습니다. [추가 데이터](expansion.json)·[개별 근거](expansion-sources.json)·[분류](taxonomy.json)·[기존 내용을 보호하는 추가 SQL](../../supabase/seed-art-expansion-round2-2026-10-13.sql)에 기록했습니다.

## 빌헬름 함메르쇼이·작품 5점 추가 — 2026-10-13

현재 작품 127점·확인 작가 27명입니다. 함메르쇼이는 SMK 소장 《바닥에 햇빛이 드는 스트란게데의 실내》, 《화가의 이젤이 있는 실내》, 《찻잔을 든 아내 이다 함메르쇼이》, 《아말리엔보르 광장》과 Met 소장 《달빛, 스트란게데 30번지》를 추가했습니다. SMK `180_person`과 Met `165225`의 작가 식별자를 대조해 한 작가로 연결했습니다.

SMK 4점은 개별 `public_domain: true`와 PDM 1.0 이용 표시를 유지하며 CC0로 바꾸지 않았습니다. Met 1점은 개별 공개 이미지·CC0를 확인했습니다. 기술 분석 이미지나 다른 면을 작품으로 추가하지 않았고, 다섯 JPEG의 HTTP 응답·실제 크기·SHA-256을 검증했습니다. 이다 초상 소개는 소장품 기록과 이미지 관찰에, 나머지는 공식 미술관 해설에 근거합니다. 한글 제목은 작업용 번역입니다.

SMK 치수는 API의 `Netto`·`Brutto` 구조화된 cm 값으로 구성하고 원자료의 메모도 보존합니다. 이젤 실내화는 SMK API에 84 × 69 cm, 별도 연구 아카이브에 84.2 × 69.5 cm로 기록되어 있어 값을 임의로 통합하지 않았습니다. 파일 기반 자료는 [expansion.json](expansion.json)·[expansion-sources.json](expansion-sources.json)에, 기존 내용을 보호하는 추가 SQL은 [seed-art-hammershoi.sql](../../supabase/seed-art-hammershoi.sql)에 있습니다.

## 새 작가 7명·작품 35점 추가 — 2026-10-13

이 배치까지 총 작품 122점, 확인 작가 26명이 되었습니다. 드가·피사로·고갱·르동·렘브란트·윈슬로 호머·베르트 모리조를 각각 5점씩 추가했습니다. 23명은 최소 5점 기준을 충족하며, 김시·이택균·Yeoseol은 추가 귀속·이용 조건이 확인되기 전까지 1점씩입니다.

35점 모두 클리블랜드 미술관의 개별 CC0 표시와 작가 ID를 대조했습니다. 렘브란트와 공방의 공동 귀속, 공방·추종자 작품, 카사트 드로잉의 앞·뒷면 중복 레코드는 채택하지 않았습니다. 르동의 같은 제목인 꽃병 두 점은 제작 연대와 재료·소장품 번호가 다른 별개 작품입니다. JPEG 응답·실제 크기·SHA-256을 검증했고, 가로로 긴 드가 작품은 미술관의 큰 이미지를 사용합니다.

새 작가의 출처를 포함한 소개는 [expansion.json](expansion.json)의 `artists`에, 작품과 개별 원자료는 같은 파일의 `artworks` 및 [expansion-sources.json](expansion-sources.json)에 보존했습니다. 한글 제목은 작업용 번역이며, 해설은 미술관 해설을 짧게 정리했습니다. 원문 제목·추정 연대·재료·모든 cm 치수는 유지합니다. [새 작가·작품 추가 SQL](../../supabase/seed-art-expansion-2026-10-13.sql)은 스키마 마이그레이션과 앞선 초기·보강 시드 적용 후 실행하며, 같은 ID의 내용이나 귀속이 다르면 전체 배치를 중단합니다. 기존 자료는 수정하지 않습니다.

## 작가별 최소 5점 보강 — 2026-10-12

초기 30점을 보존하고 57점을 추가해 당시 총 87점이 되었습니다. 확인 작가 19명 가운데 16명은 5점씩, 김시·이택균·Yeoseol은 1점씩이며 작가 미상은 4점입니다. 베르메르는 메트로폴리탄 미술관의 서로 다른 회화 4점을 추가해 5점이 되었습니다.

- [추가 작품과 작가별 출처 식별자](expansion.json)
- [귀속·공개 이용 근거와 소장품 원문 정보](expansion-sources.json)
- [기존 내용을 보호하는 보강 SQL](../../supabase/seed-art-expansion.sql)

추가 자료는 Cleveland 36점, The Met 18점, Getty·National Gallery of Art·Bowes Museum 각 1점입니다. 56점은 개별 CC0 표시와 이용 정책을 확인했습니다. Bowes의 《아침 식탁》은 Art UK 소장품 기록을 출처로 연결하고, Wikimedia Commons의 PDM 1.0·PD-Art 파일을 사용하며 CC0로 바꾸어 표시하지 않았습니다. Getty는 개별 페이지의 JSON-LD 이용 표시, NGA는 개별 이미지 공개 표시를 대조했습니다.

검색 이름만으로 작가를 연결하지 않고 기관의 작가 ID와 귀속 표현을 대조했습니다. 공방·추종자·모사·귀속 추정 자료, 다른 작가, 같은 작품의 다른 사진은 제외했습니다. 리피의 삼면 제단화 두 패널과 호이쓰의 병풍 한 쌍은 각각 한 작품으로 셉니다. 원문 제목·추정 연대·재료·액자와 장황을 포함한 치수는 유지하고 한국어 작업용 번역과 짧은 소개를 함께 기록했습니다. 해설이 없는 체이스의 두 해양 풍경과 Bowes 작품은 소장품 기록과 이미지 관찰에 근거해 소개했습니다. Met의 훌스동크 정물은 공식 공개 이미지가 흑백 기록 이미지임을 소개에 명시했습니다.

확인한 공개 기관 자료만으로 김시·이택균·Yeoseol의 추가 4점씩을 확보하지 못했습니다. 이택균의 이형록·이응록 이름도 조회했으나 다른 사람인 이하응을 합치지 않았고, 김시와 김식도 구분했습니다. 이는 전 세계 잔존 작품 수에 대한 판단이 아니라 이번에 확인한 자료 범위의 한계입니다. 다음 보강에서도 정확한 귀속과 이미지 이용 근거를 먼저 확인합니다.

모든 추가 이미지의 HTTP 응답·JPEG 형식·실제 해상도·SHA-256을 확인했습니다. 원자료와 작가별 최소 수량은 `node scripts/check-content-quality.mjs`, 공개 DB는 `node --env-file=.env.local scripts/check-content-quality.mjs --live`, 입력 스키마와 번역 치수는 `npx tsx scripts/check-art-editorial.ts`로 검사합니다. 이미지 검증 파일과 적용 전후 DB 사본은 별도 로컬 백업에 보존했으며 배포 코드는 원출처의 공개 이미지 URL을 사용합니다.

## 초기 수집 기록

2026-09-07 수집. 30점 / 98.7 MiB / 고유 JPEG 30개.

- [이미지와 함께 둘러보기](index.html)
- [작가별 작품 목록](artists.md)
- [작가별 구조화 데이터](artists.json)
- [구조화된 작품 데이터](artworks.json)
- [레퍼런스 사이트 조사](reference-sites.md)

The Met 8점과 Cleveland Museum of Art 22점입니다. 한국 회화 7점과 일본 회화·판화 5점을 포함합니다. 개별 공개 이용 표시, 원문 링크, 재료·크기·소장품 번호와 이미지 해상도·SHA-256을 기록했습니다.

한국어 제목은 작업용 번역입니다. 공식 한국어 명칭으로 확정하지 않았으며 원문을 기준 정보로 보존했습니다. 2026-10-12 소장 미술관의 작품 해설을 바탕으로 30점의 짧은 소개를 `editorial.json`에 추가했습니다. 클리블랜드 22점은 공식 API의 현재 해설과 보관 원자료가 일치하는지 확인했고, 메트로폴리탄 8점은 개별 공식 소장품 페이지의 해설을 확인했습니다. 미술관의 해석과 인물 신원 등의 추정은 소개에서 명시합니다. 테마는 이번 수집을 살펴보기 위한 편집 분류입니다. 초기 표본은 서양 회화와 동아시아에 집중되어 있어 다른 지역·여성 작가·현대 작품은 후속 수집에서 보완할 수 있습니다.

| 번호 | 작품 | 작가 — 원문 | 제작 시기 | 소장처 | 이미지 크기 |
| --- | --- | --- | --- | --- | --- |
| 1 | [사이프러스가 있는 밀밭](https://www.metmuseum.org/art/collection/search/436535) | Vincent van Gogh | 1889 | Met | 4000 × 3184 |
| 2 | [밀짚모자를 쓴 자화상](https://www.metmuseum.org/art/collection/search/436532) | Vincent van Gogh | 1887 | Met | 2829 × 3520 |
| 3 | [해바라기](https://www.metmuseum.org/art/collection/search/436524) | Vincent van Gogh | 1887 | Met | 4000 × 2826 |
| 4 | [소크라테스의 죽음](https://www.metmuseum.org/art/collection/search/436105) | Jacques Louis David | 1787 | Met | 4000 × 2663 |
| 5 | [마돈나 델라 살루테 현관에서 본 베네치아](https://www.metmuseum.org/art/collection/search/437853) | Joseph Mallord William Turner | ca. 1835 | Met | 1959 × 1461 |
| 6 | [물주전자를 든 젊은 여인](https://www.metmuseum.org/art/collection/search/437881) | Johannes Vermeer | ca. 1662 | Met | 3437 × 3866 |
| 7 | [아르장퇴유 정원의 모네 가족](https://www.metmuseum.org/art/collection/search/436965) | Edouard Manet | 1874 | Met | 4000 × 2518 |
| 8 | [창가의 남성과 여인의 초상](https://www.metmuseum.org/art/collection/search/436896) | Fra Filippo Lippi | ca. 1440 | Met | 2568 × 3875 |
| 9 | [황야의 황혼](https://clevelandart.org/art/1965.233) | Frederic Edwin Church (American, 1826–1900) | 1860 | Cleveland | 3400 × 2123 |
| 10 | [붉은 스카프](https://clevelandart.org/art/1958.39) | Claude Monet (French, 1840–1926) | c. 1868–73 | Cleveland | 2732 × 3400 |
| 11 | [수련 — 아가판투스](https://clevelandart.org/art/1960.81) | Claude Monet (French, 1840–1926) | c. 1915–26 | Cleveland | 3400 × 1581 |
| 12 | [커다란 플라타너스 — 생레미의 도로 보수공들](https://clevelandart.org/art/1947.209) | Vincent van Gogh (Dutch, 1853–1890) | 1889 | Cleveland | 3400 × 2713 |
| 13 | [생트빅투아르산](https://clevelandart.org/art/1958.21) | Paul Cezanne (French, 1839–1906) | c. 1904 | Cleveland | 3400 × 2697 |
| 14 | [알프스의 파노라마 — 당 뒤 미디](https://clevelandart.org/art/1964.420) | Gustave Courbet (French, 1819–1877) | 1877 | Cleveland | 3400 × 2428 |
| 15 | [도라 휠러의 초상](https://clevelandart.org/art/1921.1239) | William Merritt Chase (American, 1849–1916) | 1882–83 | Cleveland | 3400 × 3254 |
| 16 | [로멘 라코](https://clevelandart.org/art/1942.1065) | Pierre-Auguste Renoir (French, 1841–1919) | 1864 | Cleveland | 2706 × 3400 |
| 17 | [고기·생선·채소·과일이 있는 정물](https://clevelandart.org/art/2018.258) | Jacob van Hulsdonck (Flemish, 1582–1647) | c. 1615–20 | Cleveland | 3400 × 2344 |
| 18 | [1834년 10월 16일 영국 의회의 화재](https://clevelandart.org/art/1942.647) | Joseph Mallord William Turner (British, 1775–1851) | 1835 | Cleveland | 3400 × 2525 |
| 19 | [책과 문방 기물](https://clevelandart.org/art/2011.37) | Yi Taek-gyun (Korean, 1808–after 1883) | late 1800s | Cleveland | 3400 × 1915 |
| 20 | [안개가 걷히는 산촌의 시장](https://clevelandart.org/art/2015.517) | Unknown | early 1500s | Cleveland | 1795 × 3400 |
| 21 | [인물이 있는 설경](https://clevelandart.org/art/1987.187) | Kim Si (Korean, 1524–1593) | 1584 | Cleveland | 3400 × 2707 |
| 22 | [칠보산](https://clevelandart.org/art/1989.6) | Unknown | late 1800s | Cleveland | 3400 × 1403 |
| 23 | [겨울 풍경](https://clevelandart.org/art/1986.45) | Yeoseol (Korean) | 1500s | Cleveland | 1954 × 3400 |
| 24 | [호랑이 가족](https://clevelandart.org/art/1997.148) | Unknown | late 1800s | Cleveland | 1820 × 3400 |
| 25 | [대나무](https://clevelandart.org/art/1999.169) | Unknown | 1900s | Cleveland | 2076 × 3400 |
| 26 | [후지산 36경 — 가이후 쾌청](https://clevelandart.org/art/1930.189) | Katsushika Hokusai (Japanese, 1760–1849) | early 1830s | Cleveland | 3400 × 2329 |
| 27 | [신오하시 다리와 아타케의 소나기](https://clevelandart.org/art/1921.318) | Utagawa Hiroshige (Japanese, 1797–1858) | 1857 | Cleveland | 2285 × 3400 |
| 28 | [도카이도 53역 — 쇼노의 소나기](https://clevelandart.org/art/1948.306) | Utagawa Hiroshige (Japanese, 1797–1858) | 1833 | Cleveland | 3400 × 2270 |
| 29 | [에도 명소 백경 — 달맞이 곶](https://clevelandart.org/art/1985.320) | Utagawa Hiroshige (Japanese, 1797–1858) | 1857 | Cleveland | 2317 × 3400 |
| 30 | [오동나무와 국화](https://clevelandart.org/art/1964.386) | Sakai Hōitsu (Japanese, 1761–1828) | early 1800s | Cleveland | 3400 × 3264 |

## 수집 및 검증

공식 API에서 후보를 수집하고 selection.json의 30점을 선별했습니다. API 원자료는 candidates.json에 보관했습니다. node scripts/render-art-collection.mjs 명령은 30개 고유 작품, 개별 이용 표시, JPEG 해상도, 이미지 중복을 확인하고 검토 페이지를 다시 만듭니다. 이미지는 Met 원본 및 Cleveland print 크기의 공식 파일입니다. 소장품 판본과 작품 연대를 원자료대로 유지했습니다.
