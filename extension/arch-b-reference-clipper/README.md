# ARCH-B 참고사이트 등록 · Chrome 확장 프로그램

기존 참고사이트 등록 흐름을 사용하는 Manifest V3 확장 프로그램입니다. 운영 주소와 로컬 서버(예: `http://localhost:3002`)를 지원합니다.

## 설치

1. Chrome 127 이상에서 `chrome://extensions`를 엽니다.
2. **개발자 모드**를 켜고 **압축해제된 확장 프로그램을 로드**를 누릅니다.
3. 이 폴더(`extension/arch-b-reference-clipper`)를 선택합니다. ZIP을 받았다면 먼저 압축을 풉니다.
4. 확장 프로그램을 도구 모음에 고정합니다. 이전 버전이 설치돼 있다면 확장 프로그램의 새로고침 버튼을 누릅니다.

## 계정 연결

1. 확장 프로그램을 열고 ARCH-B 주소를 입력합니다. 현재 로컬 환경은 **http://localhost:3002**입니다.
2. **로그인하고 연결하기**를 누르고 참고사이트 관리 권한이 있는 계정으로 로그인합니다.
3. 연결 페이지에 **연결 완료**가 표시되면 등록할 사이트의 탭으로 돌아갑니다.
4. 자동 연결이 안 되면 연결 페이지의 **토큰 수동 복사**를 사용하고 팝업의 **자동 연결이 안 되나요?**에서 붙여넣습니다.

`admin`, `sub-admin`, `sub_admin` 계정만 등록할 수 있습니다. 주소를 바꾸면 해당 서버에 다시 연결해야 합니다. 실제로 확장 프로그램이 응답하기 전에는 연결 완료로 표시하지 않습니다.

## 등록

1. 등록할 웹사이트에서 확장 프로그램을 누르거나 페이지를 우클릭해 **ARCH-B 참고사이트로 등록…**을 선택합니다.
2. 자동으로 가져온 사이트 이름·주소·소개를 확인하고 수정합니다. 소개는 한국어로 적는 것을 권장합니다.
3. 관리자에 등록된 범주 중 **1–3개**를 선택합니다. 첫 번째 선택한 범주가 대표 범주입니다.
4. 대표 이미지를 확인합니다. 원하는 구도가 아니면 사이트를 스크롤한 뒤 **현재 화면 캡처**를 누릅니다. 대표 이미지가 없으면 보이는 화면을 자동으로 캡처합니다.
5. 필요하면 썸네일·로고 주소를 바꿉니다. favicon이 ICO/SVG 형식이어서 저장할 수 없으면 Google favicon 이미지로 보완하고, 그것도 실패하면 썸네일을 사용합니다.
6. **참고사이트 등록**을 누릅니다. 성공하면 관리 화면으로 이동할 수 있습니다. 같은 주소가 이미 있으면 기존 자료를 안내합니다.

보이는 화면만 캡처하며, 로그인 화면이나 개인 정보가 들어 있는 화면은 썸네일 미리보기를 확인한 뒤 등록하세요. 등록하기 전에는 캡처를 업로드하지 않습니다.

## 관리자 등록과 연결되는 처리

- 관리자 폼과 동일한 제목(160자)·소개(500자)·URL·썸네일·로고·범주 데이터를 `references`에 저장합니다.
- 썸네일과 로고는 `references` 스토리지 버킷에 WebP로 보존합니다. 썸네일은 최대 1280px, 로고는 최대 256px입니다.
- 등록 시 현재 관리자 권한을 다시 확인합니다. 캡처/원격 이미지의 형식과 크기를 검사하며, 내부 네트워크 주소와 내부 주소로의 리디렉션은 다운로드하지 않습니다.
- 참고사이트·홈 캐시를 갱신합니다. 주소 끝의 `#fragment`는 중복 검사에서 제거합니다.
- Supabase 키는 확장 프로그램에 넣지 않습니다. 서버에서 발급한 참고사이트용 토큰만 확장 프로그램의 로컬 저장소에 보관하며 페이지 콘텐츠 스크립트가 읽을 수 없게 제한합니다.
- 우클릭과 팝업은 같은 확인 폼을 사용합니다. 등록 요청은 백그라운드에서 진행합니다.

## 서버와 검증

`POST /api/extension/token`은 계정 연결, `GET /api/extension/references`는 범주 조회, `POST /api/extension/references`는 참고사이트 등록을 담당합니다. DB 스키마 추가는 필요하지 않습니다.

이번 버전의 서버 변경을 배포하기 전에는 새 확장 프로그램을 **로컬 3002번 서버**에 연결해 사용하세요.

```powershell
node scripts/check-reference-extension.mjs
npx eslint extension/arch-b-reference-clipper/*.js app/api/extension/references/route.ts app/extension/connect/ExtensionConnectClient.tsx lib/reference-assets.ts
npm run build
```

회귀 검증은 실제 코드에 Chrome API·DB·스토리지를 모의 연결합니다. 운영 참고사이트를 만들거나 삭제하지 않습니다. Chrome에 설치한 상태의 실제 클릭·등록과 운영 서버 배포 검증은 별도로 필요합니다.

Chrome API 기준: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [팝업 열기](https://developer.chrome.com/docs/extensions/reference/api/action#method-openPopup), [화면 캡처](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab).
