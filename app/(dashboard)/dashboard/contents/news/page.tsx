"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import NewsPlacement from "./NewsPlacement";
import { useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/news-feeds";
import type { NewsPost } from "@/lib/news-record";

function NewsManager() {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const page = Math.max(1, Math.min(10000, Number.parseInt(searchParams.get("page") || "1", 10) || 1));
  const category = searchParams.get("category") || "all";
  const status = searchParams.get("status") || "all";
  const query = (searchParams.get("q") || "").slice(0, 100);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ type: "news", limit: "20", offset: String((page - 1) * 20), category_id: category, draft_only: String(status === "draft"), published_only: String(status === "published"), q: query });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/admin/posts?${params}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "뉴스를 불러오지 못했습니다.");
      setPosts(data.data); setTotal(data.pagination.total); setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, category, status, query, reload]);

  async function collect() {
    setWorking("collect"); setNotice(""); setError("");
    try {
      const response = await fetch("/api/news/collect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "뉴스 수집에 실패했습니다.");
      const results = data.results as { source: string; checked: number; error: string | null }[];
      setNotice(`${results.reduce((sum, item) => sum + item.checked, 0)}건을 확인했습니다. 새 소식은 미발행 상태로 저장됩니다.${results.some(item => item.error) ? " 일부 매체를 확인하지 못했습니다." : ""}`);
      setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "뉴스 수집에 실패했습니다."); }
    finally { setWorking(""); }
  }

  async function toggle(post: NewsPost) {
    setWorking(post.id); setNotice(""); setError("");
    try {
      const response = await fetch(`/api/posts/${post.id}/publish`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_published: !post.is_published }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "발행 상태를 변경하지 못했습니다.");
      setNotice(post.is_published ? "뉴스를 비공개로 전환했습니다." : "뉴스를 발행했습니다.");
      setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "발행 상태를 변경하지 못했습니다."); }
    finally { setWorking(""); }
  }

  function pageHref(number: number) { const params = new URLSearchParams(searchParams.toString()); params.set("page", String(number)); return `/dashboard/contents/news?${params}`; }
  const pages = Math.max(1, Math.ceil(total / 20));
  return <div>
    <header className="dashboard-Header">
      <div><h1>뉴스 관리</h1><p className="mt-1 text-xs text-gray-500">수집한 소식을 한국어 기사로 편집하고 발행합니다.</p></div>
      <button type="button" onClick={collect} disabled={!!working} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{working === "collect" ? "수집 중…" : "뉴스 수집"}</button>
    </header>
    <main className="dashboard-container space-y-5">
      <NewsPlacement />
      <form key={searchParams.toString()} action="/dashboard/contents/news" method="get" className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <input type="search" name="q" aria-label="뉴스 제목 검색" placeholder="뉴스 제목 검색" defaultValue={query} maxLength={100} className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <select name="category" aria-label="뉴스 분야" defaultValue={category} className="rounded-md border border-gray-200 px-3 py-2 text-sm"><option value="all">전체 분야</option>{Object.entries(CATEGORIES).filter(([key]) => key !== "editorial").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select name="status" aria-label="발행 상태" defaultValue={status} className="rounded-md border border-gray-200 px-3 py-2 text-sm"><option value="all">전체 상태</option><option value="published">발행</option><option value="draft">미발행</option></select>
        <button className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium">적용</button>
      </form>
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <div className="flex items-center justify-between text-sm text-gray-500"><p>총 {total}편</p><Link href="/news/stories" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">사이트에서 보기 ↗</Link></div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gray-50 text-gray-600"><tr>{["기사", "분야 · 매체", "발행일", "조회 · 저장", "상태", "관리"].map(label => <th key={label} className="p-4 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={6} className="p-10 text-center text-gray-500">뉴스를 불러오는 중…</td></tr> : posts.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-gray-500">조건에 맞는 뉴스가 없습니다.</td></tr> : posts.map(post => <tr key={post.id} className="hover:bg-gray-50">
              <td className="max-w-[340px] p-4"><Link href={`/dashboard/contents/news/${post.id}/edit`} className="font-semibold text-gray-950 hover:underline">{post.title}</Link><p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{post.summary}</p></td>
              <td className="p-4 text-gray-600"><p>{CATEGORIES[post.content?.category] || "미분류"}</p><p className="mt-1 text-xs">{post.content?.source || "—"}</p></td>
              <td className="whitespace-nowrap p-4 text-gray-500">{post.published_at ? new Date(post.published_at).toLocaleDateString("ko-KR") : "—"}</td>
              <td className="whitespace-nowrap p-4 text-gray-500">{post.view_count || 0} · {post.scrap_count || 0}</td>
              <td className="p-4"><button type="button" disabled={!!working} onClick={() => toggle(post)} aria-label={`${post.is_published ? "발행 취소" : "발행"}: ${post.title}`} className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${post.is_published ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{post.is_published ? "발행" : post.content?.paragraphs?.length ? "미발행" : "가공 대기"}</button></td>
              <td className="p-4"><Link href={`/dashboard/contents/news/${post.id}/edit`} className="whitespace-nowrap rounded-md border border-gray-200 px-3 py-1.5 text-xs">편집</Link>{post.is_published && <Link href={`/news/read/${post.slug}`} target="_blank" rel="noopener noreferrer" className="mt-2 block whitespace-nowrap text-xs text-gray-500 hover:underline">기사 보기 ↗</Link>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <nav aria-label="뉴스 페이지" className="flex justify-center gap-4 text-sm"><Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none text-gray-400" : "hover:underline"}>이전</Link><span>{page} / {pages}</span><Link href={pageHref(Math.min(pages, page + 1))} aria-disabled={page >= pages} className={page >= pages ? "pointer-events-none text-gray-400" : "hover:underline"}>다음</Link></nav>
    </main>
  </div>;
}

export default function NewsPage() { return <Suspense fallback={<div className="p-6">뉴스를 불러오는 중…</div>}><NewsManager /></Suspense>; }
