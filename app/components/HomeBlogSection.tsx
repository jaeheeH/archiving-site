import Link from "next/link";
import Image from "next/image";
import { formatKoreanDate } from "@/lib/date-format";

type BlogPost = {
  id: string;
  title: string;
  subtitle?: string;
  summary?: string;
  slug: string;
  published_at?: string;
  created_at: string;
  title_image_url?: string;
  category_id?: string;
  view_count: number;
  scrap_count: number;
};

interface HomeBlogSectionProps {
  initialPosts: BlogPost[];
  categories: Record<string, string>;
}

export default function HomeBlogSection({ initialPosts, categories }: HomeBlogSectionProps) {
  const posts = initialPosts.slice(0, 3);
  const getCategoryName = (post: BlogPost) =>
    post.category_id ? categories[post.category_id] || 'Story' : 'Story';

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-20 md:px-6 md:py-28">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">작품 곁의 이야기</h2>
          <p className="mt-2 text-sm leading-6 text-[#85857f]">감상과 조사, 수집 과정에서 발견한 맥락을 기록합니다.</p>
        </div>
        <Link href="/blog" aria-label="모든 블로그 글 보기" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d9d9d5] transition hover:bg-black hover:text-white">
          <i className="ri-arrow-right-line" aria-hidden="true" />
        </Link>
      </div>

      {!posts.length ? (
        <div className="rounded-[14px] bg-[#f5f5f2] py-20 text-center text-sm text-[#85857f]">
          첫 번째 작업 기록을 준비하고 있습니다.
        </div>
      ) : (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group block min-w-0">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-[#f2f2ef]">
                {post.title_image_url ? (
                  <Image
                    src={post.title_image_url}
                    alt={post.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                    quality={80}
                  />
                ) : (
                  <span className="grid h-full place-items-center text-xs font-semibold tracking-[0.16em] text-[#aaa9a3]">ARCH-B</span>
                )}
              </span>
              <span className="block pt-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#898984]">{getCategoryName(post)}</span>
                <strong className="mt-2 block line-clamp-2 text-xl font-semibold leading-snug tracking-[-0.025em] group-hover:underline">{post.title}</strong>
                <span className="mt-2 block text-sm text-[#8b8b85]">{formatKoreanDate(post.published_at || post.created_at, "short")}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
