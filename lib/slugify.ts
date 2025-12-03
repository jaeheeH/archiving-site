// lib/slugify.ts

/**
 * 한글 제목을 URL에 적합한 slug로 변환
 * - 한글 → 로마자 변환 (간단한 음차)
 * - 영문 → 소문자
 * - 공백 → 하이픈
 * - 특수문자 제거
 */

// 초성
const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHOSUNG_ROMAN = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];

// 중성
const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JUNGSUNG_ROMAN = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];

// 종성
const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JONGSUNG_ROMAN = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];

function decomposeHangul(char: string): string {
  const code = char.charCodeAt(0);

  // 한글 완성형 범위 체크
  if (code < 0xAC00 || code > 0xD7A3) {
    return char;
  }

  const base = code - 0xAC00;

  const cho = Math.floor(base / 588);
  const jung = Math.floor((base % 588) / 28);
  const jong = base % 28;

  let result = '';
  result += CHOSUNG_ROMAN[cho];
  result += JUNGSUNG_ROMAN[jung];
  result += JONGSUNG_ROMAN[jong];

  return result;
}

export function generateSlug(title: string, useTimestamp: boolean = false): string {
  let slug = '';

  // 각 문자 처리
  for (let i = 0; i < title.length; i++) {
    const char = title[i];

    // 한글인 경우
    if (/[가-힣]/.test(char)) {
      slug += decomposeHangul(char);
    }
    // 영문, 숫자인 경우
    else if (/[a-zA-Z0-9]/.test(char)) {
      slug += char.toLowerCase();
    }
    // 공백인 경우
    else if (/\s/.test(char)) {
      slug += '-';
    }
    // 그 외 특수문자는 무시
  }

  // 연속된 하이픈 제거
  slug = slug.replace(/-+/g, '-');

  // 앞뒤 하이픈 제거
  slug = slug.replace(/^-+|-+$/g, '');

  // slug가 비어있으면 타임스탬프 사용
  if (!slug || slug.length === 0) {
    slug = 'post';
  }

  // 타임스탬프 추가 옵션 (중복 방지용)
  if (useTimestamp) {
    const timestamp = Date.now().toString(36); // 36진수로 변환하여 짧게
    slug = `${slug}-${timestamp}`;
  }

  return slug;
}

/**
 * slug 유효성 검사
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
