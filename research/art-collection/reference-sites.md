# 작품 수집과 서비스 구성에 참고할 사이트

확인일: 2026-09-07. 공개 웹페이지·공식 안내·API를 기준으로 조사했다. 관찰 사실과 ARCH-B에 적용할 제안은 구분했다. 사이트별 성과 수치를 비교한 자료는 아니다.

## 먼저 볼 세 곳

1. **[DailyArt](https://www.getdailyart.com/)** — 오늘의 작품과 짧은 이야기의 기준.
2. **[Rijksmuseum Collection](https://www.rijksmuseum.nl/en/collection)** — 작품들을 모아 자기만의 이야기를 만드는 경험의 기준.
3. **[Cleveland Museum of Art Open Access](https://www.clevelandart.org/open-access)** — 작품 이미지와 정보를 실제로 확보할 수집처. 이번에 22점을 수집했다.

## 감상과 탐색 경험

| 사이트 | 실제 확인한 내용 | ARCH-B에 적용할 제안 | 확인 범위 |
| --- | --- | --- | --- |
| [DailyArt](https://www.getdailyart.com/) | 하루 한 작품과 짧은 이야기, 작가·미술관 정보, 테마 컬렉션을 소개한다. | 방문하자마자 감상할 작품 한 점을 제시하고, 관심이 생기면 배경과 같은 주제의 작품으로 연결한다. | 공식 서비스 소개와 FAQ. 앱 내부의 저장 동작은 직접 테스트하지 않았다. |
| [Rijksmuseum Collection](https://www.rijksmuseum.nl/en/collection) | 작품 검색 외에 Visitor stories, Tell your story, Art Explorer, 나만의 Gallery of Honour를 만드는 진입점이 있다. | 개인 컬렉션에 이름과 짧은 소개를 붙여 작품을 모은 이유를 남길 수 있게 한다. | 공개 컬렉션 첫 화면과 링크. 로그인 후 작성·저장 흐름은 테스트하지 않았다. |
| [Google Arts & Culture](https://artsandculture.google.com/) | 색상별 탐색과 같은 작가·매체·시기·대상·컬렉션을 근거로 연결한 추천을 제공한다. | 처음에는 주제·작가 탐색과 추천 이유 표시를 적용한다. 색상 탐색은 작품 수가 늘어난 뒤 검토한다. | 공개 홈의 색상 탐색과 연관 작품 설명 확인. |
| [29Magazine](https://www.29cm.co.kr/content/29magazine) | 최신·월별 목록, 고정 연재명, 회차, 날짜, 짧은 소개를 제공한다. | 작품 모음에 ‘그림 속 정원’처럼 구체적인 테마를 붙이고 정기적으로 새로운 컬렉션을 편집한다. | 공개 목록 및 [브랜드 코멘터리 사례](https://www.29cm.co.kr/content/29-brand-commentary/2026/09/magpieandtiger) 본문 확인. |

DailyArt는 기본 감상 경험에, Rijksmuseum은 모으는 경험에 우선 참고한다. 29Magazine은 테마 편집의 보조 레퍼런스로 사용한다. 위 서비스의 콘텐츠를 그대로 가져오는 제안은 아니다.

## 실제 작품 수집처

| 수집처 | 확보 가능한 자료와 근거 | 이번 작업 | 다음 활용 |
| --- | --- | --- | --- |
| [The Met Open Access](https://www.metmuseum.org/hubs/open-access) · [공식 API 안내](https://metmuseum.github.io/) | OA 작품의 이미지와 기본 데이터를 CC0로 제공한다. 작품 응답의 isPublicDomain과 이미지 주소를 확인할 수 있다. | 8점 수집. 반 고흐·베르메르·마네·터너 등의 원본 JPEG와 작품 정보를 저장했다. | 작가별 확장, 유럽 회화 및 다양한 문화권 자료 수집. |
| [Cleveland Open Access](https://www.clevelandart.org/open-access) · [공식 API](https://openaccess-api.clevelandart.org/) | 공개 작품의 이미지와 데이터를 제공하고 개별 share_license_status를 기록한다. | CC0인 22점 수집. 한국 회화 7점, 일본 회화·판화 5점 포함. | 한국·동아시아 자료를 서양 회화와 함께 수집하고 문화권·재료별로 확장. |
| [National Gallery of Art — Free Images](https://www.nga.gov/artworks/free-images-and-open-access) | 공개 이용 이미지의 다운로드와 작품·작가 데이터 다운로드를 안내한다. 데이터 공개 범위와 이미지 공개 범위는 별도로 설명한다. | 공식 제공 정책 확인. 이번 30점에는 포함하지 않았다. | 다운로드 가능한 작품 페이지를 골라 미국·유럽 회화 후보 확장. |
| [국립중앙박물관 e뮤지엄](https://www.emuseum.go.kr/main) | 국내 박물관 소장품의 통합 검색과 소장품 정보를 제공한다. | 공개 사이트 확인. 개별 이미지 이용 조건이나 대량 수집 방식은 이번에 검증하지 않았다. | 한국어 작품명·소장처의 교차 확인과 한국 작품 후보 탐색. 개별 자료 조건 확인 후 이미지 수집. |

Google Arts & Culture와 Rijksmuseum은 이번에는 탐색 레퍼런스로 검토했다. 해당 사이트 전체의 이미지를 일괄 재사용할 수 있다고 판단하지 않았다. Art Institute of Chicago는 공개 안내 페이지 접근이 403으로 제한되어 이번 검증된 수집처 목록에서 제외했다.

## 수집한 작품으로 바로 비교해 볼 경험

### 1. 하루 한 작품

[반 고흐의 Wheat Field with Cypresses](https://www.metmuseum.org/art/collection/search/436535)를 첫 후보로 삼는다. 전체 이미지와 작품 정보를 먼저 보여주고, 원문 기반 해설을 추가하는 방식이다. 이번 결과물에는 작품 이미지와 정보까지 수집했으며 해설은 아직 작성하지 않았다.

### 2. 하나의 관심에서 여러 작품으로

이번 30점을 ‘빛과 풍경’, ‘인물과 일상’, ‘꽃과 사물’, ‘동아시아의 장면’ 네 가지 필터로 묶었다. 동일 작품은 여러 필터에 연결할 수 있다. 이는 검토용 분류이며 시대나 사조의 공식 분류를 대체하지 않는다.

### 3. 출처가 보이는 감상

검토 페이지의 각 작품에서 재료·크기·소장처·제작 시기와 공식 작품 페이지를 확인할 수 있다. 모네나 반 고흐처럼 비슷한 제목의 여러 작품이 있을 때는 소장품 번호와 이미지를 함께 확인한다.

## 이번 결과와 다음 수집의 기준

실제 수집 목록과 로컬 이미지는 [수집 목록](README.md), [작품 데이터](artworks.json), [이미지 검토 페이지](index.html)에 있다. 수집은 ‘작품·출처·이용 표시·이미지’를 하나의 묶음으로 보관하는 방식으로 진행했다.

추가 수집은 지금의 유럽·동아시아 중심 표본을 보완할 지역과 작가를 우선 검토한다. 이미지가 확보되지 않은 항목, 제목만 확인된 항목, 사용 조건을 확인하지 못한 항목은 수집 완료 수량으로 계산하지 않는다.
