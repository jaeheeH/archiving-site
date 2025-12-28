/**
 * 이미지 URL을 최적화된 형식으로 변환
 * Supabase Storage의 이미지를 WebP로 변환하고 리사이징
 */

export function optimizeImageUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string {
  if (!url) return url;

  const { width = 1200, height, quality = 80, format = 'webp' } = options;

  // Supabase Storage URL인지 확인
  if (!url.includes('supabase.co')) {
    return url;
  }

  // 이미 쿼리 파라미터가 있으면 제거
  const cleanUrl = url.split('?')[0];

  // 이미지 변환 파라미터 구성
  const params = new URLSearchParams();
  
  if (width) params.append('width', String(width));
  if (height) params.append('height', String(height));
  if (format) params.append('format', format);
  if (quality) params.append('quality', String(quality));

  // transform 파라미터로 URL 재구성
  return `${cleanUrl}?${params.toString()}`;
}

/**
 * srcset 생성 (반응형 이미지)
 */
export function generateImageSrcSet(url: string): string {
  const sizes = [400, 800, 1200, 1600];
  return sizes
    .map((size) => `${optimizeImageUrl(url, { width: size, format: 'webp' })} ${size}w`)
    .join(', ');
}

/**
 * 에디터 콘텐츠의 모든 이미지 URL 최적화
 */
export function optimizeEditorImages(htmlContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  doc.querySelectorAll('img').forEach((img) => {
    const originalSrc = img.getAttribute('src');
    if (originalSrc) {
      // 이미지 최적화
      img.setAttribute('src', optimizeImageUrl(originalSrc, { width: 800, format: 'webp' }));
      
      // srcset 추가 (반응형)
      img.setAttribute('srcset', generateImageSrcSet(originalSrc));
      img.setAttribute('sizes', '(max-width: 640px) 100vw, (max-width: 1024px) 800px, 1200px');
      
      // 로딩 속성
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
    }
  });

  return doc.documentElement.outerHTML;
}