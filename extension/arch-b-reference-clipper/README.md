# ARCH-B Reference Clipper

현재 보고 있는 웹사이트를 ARCH-B 레퍼런스로 바로 저장하는 Chrome Manifest V3 확장자입니다.

## 로컬 설치

1. Chrome에서 `chrome://extensions` 열기
2. 우측 상단 `개발자 모드` 켜기
3. `압축해제된 확장 프로그램을 로드` 클릭
4. 이 폴더 선택:

```text
extension/arch-b-reference-clipper
```

## 연결

1. 확장자 팝업 열기
2. 로컬 개발 서버에서 테스트하려면 `ARCH-B URL`을 `http://localhost:3000`으로 변경 후 저장
3. `ARCH-B 연결하기` 클릭
4. `/extension/connect` 페이지에서 자동 연결 완료 확인

## 사용

- 확장자 아이콘 클릭 후 제목/설명/카테고리를 확인하고 `ARCH-B에 저장`
- 페이지 우클릭 후 `ARCH-B 레퍼런스로 저장`
- 저장 시 원격 `og:image`와 favicon은 ARCH-B 서버가 Supabase Storage `references` 버킷으로 복사한 뒤 DB에 저장합니다.

## 서버 API

- `POST /api/extension/token`: 로그인된 ARCH-B 계정으로 확장자 토큰 발급
- `GET /api/extension/references`: 카테고리 조회
- `POST /api/extension/references`: 확장자 토큰으로 레퍼런스 저장

확장자에는 Supabase 키를 넣지 않습니다.
