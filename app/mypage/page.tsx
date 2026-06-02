import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ChevronRight,
  ExternalLink,
  FileText,
  ImageIcon,
  Sparkles,
  UserRound,
} from "lucide-react";

import { getMypageActivity, getMypageProfile } from "@/lib/mypage-data";
import { getHomeData } from "@/lib/public-data";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value?: string | null) {
  if (!value) return "날짜 없음";
  return dateFormat.format(new Date(value));
}

function getTime(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getDailyIndex(length: number) {
  if (length < 1) return 0;

  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const seed = todayKey
    .split("-")
    .reduce((total, part, index) => total + Number(part) * (index + 1), 0);

  return seed % length;
}

export default async function MyPage() {
  const [user, activity, homeData] = await Promise.all([
    getMypageProfile(),
    getMypageActivity(),
    getHomeData(),
  ]);

  if (!user || !activity) {
    redirect("/login?redirect=/mypage");
  }

  const totalSaved = activity.posts.length + activity.galleries.length + activity.references.length;
  const dailyGallery = homeData.gallery[getDailyIndex(homeData.gallery.length)];
  const fallbackBlog = homeData.latestBlogs[0];
  const fallbackReference = homeData.references[0];
  const todayRecommendation = dailyGallery
    ? {
        label: "오늘의 이미지",
        title: dailyGallery.title,
        description: dailyGallery.description || "오늘 새롭게 살펴볼 시각 레퍼런스입니다.",
        href: `/gallery/${dailyGallery.id}`,
        image: dailyGallery.thumbnail_url || dailyGallery.image_url,
      }
    : fallbackBlog
      ? {
          label: "오늘의 글",
          title: fallbackBlog.title,
          description: fallbackBlog.summary || fallbackBlog.subtitle || "오늘 읽어볼 만한 블로그 글입니다.",
          href: `/blog/${fallbackBlog.slug}`,
          image: fallbackBlog.title_image_url,
        }
      : fallbackReference
        ? {
            label: "오늘의 레퍼런스",
            title: fallbackReference.title,
            description: fallbackReference.description || fallbackReference.url,
            href: fallbackReference.url || "/references",
            image: fallbackReference.image_url || fallbackReference.logo_url,
          }
        : null;

  const recentSavedItems = [
    ...activity.posts.map((post) => ({
      key: `blog-${post.id}`,
      type: "Blog",
      title: post.title,
      description: post.summary || post.subtitle || "북마크한 블로그입니다.",
      href: `/blog/${post.slug}`,
      date: post.published_at || post.created_at,
      image: post.title_image_url,
      icon: <FileText className="h-5 w-5" />,
    })),
    ...activity.galleries.map((gallery) => ({
      key: `gallery-${gallery.id}`,
      type: "Gallery",
      title: gallery.title,
      description: gallery.description || "저장한 갤러리 이미지입니다.",
      href: `/gallery/${gallery.id}`,
      date: gallery.created_at,
      image: gallery.thumbnail_url || gallery.image_url,
      icon: <ImageIcon className="h-5 w-5" />,
    })),
    ...activity.references.map((reference) => ({
      key: `reference-${reference.id}`,
      type: "Reference",
      title: reference.title,
      description: reference.description || reference.url,
      href: reference.url || "/references",
      date: reference.created_at,
      image: reference.image_url || reference.logo_url,
      external: Boolean(reference.url),
      icon: <ExternalLink className="h-5 w-5" />,
    })),
  ]
    .sort((a, b) => getTime(b.date) - getTime(a.date))
    .slice(0, 6);

  return (
    <section className="w-full">
      <div className="mb-8 grid gap-5 xl:grid-cols-[1fr_320px]">
        <TodayRecommendation recommendation={todayRecommendation} />

        <div className="rounded-lg border border-[var(--archive-line)] bg-white p-5">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[var(--archive-line)] bg-gray-100">
              {user.avatar_url ? (
                <Image src={user.avatar_url} alt={user.nickname} fill sizes="64px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-bold text-gray-500">
                  {user.nickname.charAt(0) || user.email.charAt(0) || "U"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-950">{user.nickname || "사용자"}</p>
              <p className="mt-1 truncate text-sm text-[var(--archive-muted)]">{user.email}</p>
            </div>
          </div>
          <Link
            href="/mypage/profile"
            className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[var(--archive-line)] text-sm font-semibold text-gray-700 transition hover:border-[#ff4800] hover:text-[#ff4800]"
          >
            <UserRound className="h-4 w-4" />
            내 정보 수정
          </Link>
        </div>
      </div>

      <Link
        href="/mypage/activity"
        className="mb-3 flex items-center justify-between gap-4 border-y border-[var(--archive-line)] px-4 py-3 text-sm font-semibold text-[#ff4800] transition hover:border-[#ff4800]"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          오늘의 추천은 매일 바뀝니다. 저장한 콘텐츠는 내 활동에서 관리할 수 있어요.
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </Link>

      <div className="mb-10 grid border-y border-[var(--archive-line)] bg-white sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCell label="전체 저장" value={totalSaved} href="/mypage/activity" />
        <SummaryCell label="Blog" value={activity.posts.length} href="/mypage/activity?tab=blog" />
        <SummaryCell label="Gallery" value={activity.galleries.length} href="/mypage/activity?tab=gallery" />
        <SummaryCell label="Reference" value={activity.references.length} href="/mypage/activity?tab=reference" />
      </div>

      <RecentSavedList items={recentSavedItems} />
    </section>
  );
}

function TodayRecommendation({
  recommendation,
}: {
  recommendation: {
    label: string;
    title: string;
    description: string | null;
    href: string;
    image: string | null;
  } | null;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--archive-line)] bg-white">
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_260px] md:p-6">
        <div className="flex min-w-0 flex-col justify-center">
          <p className="archive-eyebrow text-[#ff4800]">{recommendation?.label || "오늘의 추천"}</p>
          <h2 className="mt-3 line-clamp-2 text-2xl font-bold tracking-tight text-gray-950 md:text-3xl">
            {recommendation?.title || "오늘 살펴볼 콘텐츠를 준비 중입니다."}
          </h2>
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-[var(--archive-muted)]">
            {recommendation?.description || "새로운 블로그와 갤러리, 레퍼런스를 둘러보세요."}
          </p>
          <Link
            href={recommendation?.href || "/gallery"}
            className="mt-6 inline-flex h-10 w-fit items-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-[#ff4800]"
          >
            추천 보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <Link
          href={recommendation?.href || "/gallery"}
          className="relative aspect-[16/10] overflow-hidden rounded-md bg-gray-100 text-[var(--archive-muted)]"
        >
          {recommendation?.image ? (
            <Image src={recommendation.image} alt={recommendation.title} fill sizes="260px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-8 w-8" />
            </span>
          )}
        </Link>
      </div>
    </section>
  );
}

function SummaryCell({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="group border-[var(--archive-line)] p-5 transition-colors hover:bg-[#ff4800]/5 sm:border-r xl:last:border-r-0"
    >
      <div className="flex items-center gap-1 text-sm font-semibold text-[var(--archive-muted)]">
        {label}
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-[#ff4800]" />
      </div>
      <p className="mt-8 text-3xl font-bold tracking-tight text-gray-950">{value}</p>
    </Link>
  );
}

function RecentSavedList({
  items,
}: {
  items: Array<{
    key: string;
    type: string;
    title: string;
    description: string | null;
    href: string;
    date: string | null;
    image: string | null;
    external?: boolean;
    icon: ReactNode;
  }>;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <h3 className="text-lg font-bold tracking-tight text-gray-950">최근 저장 콘텐츠</h3>
        <Link href="/mypage/activity" className="text-sm font-semibold text-[var(--archive-muted)] transition hover:text-[#ff4800]">
          더보기
        </Link>
      </div>

      <div className="border-t-2 border-gray-950">
        <div className="hidden grid-cols-[130px_110px_1fr_72px] border-b border-[var(--archive-line)] py-3 text-xs font-bold text-gray-950 md:grid">
          <span className="px-3">날짜</span>
          <span className="px-3">유형</span>
          <span className="px-3">제목</span>
          <span className="px-3 text-right">이동</span>
        </div>

        {items.length === 0 ? (
          <div className="border-b border-[var(--archive-line)] py-14 text-center text-sm text-[var(--archive-muted)]">
            아직 저장한 콘텐츠가 없습니다.
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="group grid gap-3 border-b border-[var(--archive-line)] py-4 transition-colors hover:bg-[#ff4800]/5 md:grid-cols-[130px_110px_1fr_72px] md:items-center"
              >
                <span className="px-3 text-xs text-[var(--archive-muted)]">{formatDate(item.date)}</span>
                <span className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff4800]">
                  {item.type}
                </span>
                <span className="grid min-w-0 grid-cols-[48px_1fr] gap-3 px-3">
                  <span className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100 text-[var(--archive-muted)]">
                    {item.image ? (
                      <Image src={item.image} alt={item.title} fill sizes="48px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">{item.icon}</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-sm font-bold text-gray-950 transition group-hover:text-[#ff4800]">
                      {item.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--archive-muted)]">
                      {item.description || "내용이 없습니다."}
                    </span>
                  </span>
                </span>
                <span className="hidden px-3 text-right text-xs font-semibold text-[var(--archive-muted)] transition group-hover:text-[#ff4800] md:block">
                  보기
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
