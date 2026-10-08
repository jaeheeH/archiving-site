import { canOptimizeImage } from './public-image';
/**
 * 이미지 URL을 최적화된 형식으로 변환
 * Next Image의 기존 캐시와 이미지 변환을 사용
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
  if (!url || !canOptimizeImage(url)) return url;
  const width = [16, 32, 64, 128, 256, 384, 640, 828, 1200].find(size => size >= (options.width || 1200)) || 1200;
  // Use Next's existing optimizer; arbitrary query parameters on a Storage object do not resize it.
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
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