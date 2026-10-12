# 실제 작품 수집 01

## 작가별 최소 5점 보강 — 2026-10-12

초기 30점을 보존하고 57점을 추가해 현재 총 87점입니다. 확인 작가 19명 가운데 16명은 5점씩, 김시·이택균·Yeoseol은 1점씩이며 작가 미상은 4점입니다. 베르메르는 메트로폴리탄 미술관의 서로 다른 회화 4점을 추가해 5점이 되었습니다.

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
