// Exact public origins shared by Next Image and the social-card renderer.
export const PUBLIC_IMAGE_HOSTS = [
  'lh3.googleusercontent.com', 'k.kakaocdn.net', 'img1.kakaocdn.net', 't1.kakaocdn.net',
  'images.metmuseum.org', 'openaccess-cdn.clevelandart.org', 'overgjynkrnwayfammid.supabase.co',
  'about.fb.com', 'blog.cloudflare.com', 'blog.developer.adobe.com', 'blogs.nvidia.com',
  'cdn-images-1.medium.com', 'design-milk.com', 'files.smashing.media', 'github.com',
  'img.kr.news.samsung.com', 'static.dezeen.com', 'static.toss.im', 'storage.googleapis.com',
];
export function canOptimizeImage(value: string) {
  if (value.startsWith('/') && !value.startsWith('//')) return !value.startsWith('/api/');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && PUBLIC_IMAGE_HOSTS.includes(url.hostname)
      && (!url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/storage/v1/object/public/'));
  } catch { return false; }
}
