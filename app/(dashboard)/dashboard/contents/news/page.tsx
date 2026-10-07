"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import NewsPlacement from "./NewsPlacement";
import ContentPagination from "@/app/(dashboard)/components/ContentPagination";
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
  const [queue, setQueue] = useState<{ waiting: number; writing: number; failed: number } | null>(null);
  const pipeline = useRef<AbortController | null>(null);
  useEffect(() => () => pipeline.current?.abort(), []);
  const page = Math.max(1, Math.min(10000, Number.parseInt(searchParams.get("page") || "1", 10) || 1));
  const category = searchParams.get("category") || "all";
  const status = searchParams.get("status") || "all";
  const query = (searchParams.get("q") || "").slice(0, 100);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ type: "news", limit: "20", offset: String((page - 1) * 20), category_id: category, draft_only: String(status === "draft"), published_only: String(status === "published"), review_only: String(status === "review"), q: query });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/admin/posts?${params}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "뉴스를 불러오지 못했습니다.");
      setPosts(data.data); setTotal(data.pagination.total); setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch('/api/news/process', { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error(); setQueue(await response.json()); }).catch(() => { if (!controller.signal.aborted) setQueue(null); });
    return () => controller.abort();
  }, [page, category, status, query, reload]);

  async function collect(withCollection = true) {
    const controller = new AbortController(); pipeline.current = controller;
    setWorking("collect"); setNotice(withCollection ? "뉴스를 수집하고 자료 조사·기사 작성을 진행합니다." : "대기 뉴스의 자료 조사·기사 작성을 진행합니다."); setError("");
    try {
      const response = await fetch(withCollection ? "/api/news/collect" : "/api/news/process", { method: "POST", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "수집·자동 작성에 실패했습니다.");
      const results = (data.results || []) as { inserted: number; error: string | null }[];
      const collected = results.reduce((sum, item) => sum + item.inserted, 0);
      let step = withCollection ? data.writing : data;
      let written = 0, failed = 0;
      for (let index = 0; index < 15; index++) {
        written += step.written; failed += step.failed;
        setNotice(`${withCollection ? `새 뉴스 ${collected}편 수집 · ` : ''}초안 ${written}편 작성 · 실패 ${failed}편 · 작성 대기 ${step.remaining}편${step.remaining && index < 14 ? ' · 계속 작성 중…' : ''}${results.some(item => item.error) ? ' 일부 매체의 수집에 실패했습니다.' : ''}`);
        setReload(value => value + 1);
        if (step.items?.some((item: { error?: string }) => /사용량 한도|Gemini.+요청.+(?:401|403)|API key not valid/i.test(item.error || ''))) throw new Error('Gemini 호출을 중단했습니다. 작성된 초안은 저장되어 있으며 실패 원인은 각 기사에서 확인할 수 있습니다.');
        if (!step.remaining || index === 14 || controller.signal.aborted) break;
        const next = await fetch('/api/news/process', { method: 'POST', signal: controller.signal });
        step = await next.json();
        if (!next.ok) throw new Error(step.error || '자동 작성에 실패했습니다.');
      }
    } catch (cause) { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "수집·자동 작성에 실패했습니다."); setReload(value => value + 1); } }
    finally { if (!controller.signal.aborted) setWorking(""); }
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
      <div><h1>뉴스 관리</h1><p className="mt-1 text-xs text-gray-500">수집부터 자료 조사·한국어 초안 작성까지 자동으로 진행합니다.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => collect(false)} disabled={!!working} className="content-table-action">대기 뉴스 자동 작성</button><button type="button" onClick={() => collect()} disabled={!!working} className="content-table-create">{working === "collect" ? "수집·작성 중…" : "수집 + 자동 작성"}</button></div>
    </header>
    <main className="dashboard-container space-y-5">
      <section className="rounded-lg border border-gray-200 bg-white p-5" aria-label="뉴스 자동 작성">
        <h2 className="text-sm font-semibold">수집 → 참고자료 조사 → 기사 작성 → 초안 검토</h2>
        <p className="mt-2 text-xs leading-6 text-gray-500">공식 근거를 포함한 참고자료를 조사하고 1,800~3,000자 기사를 작성합니다. 한 번에 최대 15편을 처리하며, 이미 작성된 글은 덮어쓰지 않습니다. 발행은 검토 후 직접 진행합니다.</p>
        <p className="mt-3 text-sm text-gray-700">{queue ? `작성 대기 ${queue.waiting}편 · 진행 중 ${queue.writing}편 · 실패 기록 ${queue.failed}편` : '작성 상태를 확인하고 있습니다.'}</p>
      </section>
      <NewsPlacement />
      <form key={searchParams.toString()} action="/dashboard/contents/news" method="get" className="content-table-filters">
        <input type="search" name="q" aria-label="뉴스 제목 검색" placeholder="뉴스 제목 검색" defaultValue={query} maxLength={100} className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <select name="category" aria-label="뉴스 분야" defaultValue={category} className="rounded-md border border-gray-200 px-3 py-2 text-sm"><option value="all">전체 분야</option>{Object.entries(CATEGORIES).filter(([key]) => key !== "editorial").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select name="status" aria-label="발행 상태" defaultValue={status} className="rounded-md border border-gray-200 px-3 py-2 text-sm"><option value="all">전체 상태</option><option value="review">검토 대기</option><option value="published">발행</option><option value="draft">미발행</option></select>
        <button className="content-table-action">적용</button>
      </form>
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <div className="content-table-meta"><p>총 {total}편</p><Link href="/news/stories" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">사이트에서 보기 ↗</Link></div>
      <div className="content-table-wrap">
        <table className="content-table content-table-news text-left text-sm" aria-label="뉴스 목록">
          <thead><tr><th className="content-table-title">기사</th><th>분야 · 매체</th><th className="content-table-date">발행일</th><th className="content-table-count">조회 · 저장</th><th className="content-table-status">상태</th><th className="content-table-action-cell">관리</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={6} className="p-10 text-center text-gray-500">뉴스를 불러오는 중…</td></tr> : posts.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-gray-500">조건에 맞는 뉴스가 없습니다.</td></tr> : posts.map(post => <tr key={post.id} className="hover:bg-gray-50">
              <td><Link href={`/dashboard/contents/news/${post.id}/edit`} className="line-clamp-2 font-medium text-gray-950 hover:underline">{post.title}</Link><p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{post.summary}</p></td>
              <td className="p-4 text-gray-600"><p>{CATEGORIES[post.content?.category] || "미분류"}</p><p className="mt-1 text-xs">{post.content?.source || "—"}</p></td>
              <td className="whitespace-nowrap p-4 text-gray-500">{post.published_at ? new Date(post.published_at).toLocaleDateString("ko-KR") : "—"}</td>
              <td className="content-table-count whitespace-nowrap text-gray-500">{post.view_count || 0} · {post.scrap_count || 0}</td>
              <td className="content-table-status"><button type="button" disabled={!!working || (!post.is_published && !post.content?.paragraphs?.length)} onClick={() => toggle(post)} aria-label={`${post.is_published ? "발행 취소" : "발행"}: ${post.title}`} className="content-table-badge" data-state={post.is_published ? 'published' : 'draft'}>{post.is_published ? "발행" : post.content?.paragraphs?.length ? "검토 대기" : post.content?.automation?.status === 'writing' ? '조사·작성 중' : post.content?.automation?.status === 'failed' ? '작성 실패' : "작성 대기"}</button>{post.content?.automation?.error && <p className="mt-2 max-w-[180px] text-xs leading-5 text-red-700">{post.content.automation.error}</p>}</td>
              <td className="content-table-action-cell"><Link href={`/dashboard/contents/news/${post.id}/edit`} className="content-table-action" aria-label={`${post.title} 수정`}><i className="ri-edit-line" aria-hidden="true" />수정</Link>{post.is_published && <Link href={`/news/read/${post.slug}`} target="_blank" rel="noopener noreferrer" className="mt-2 block whitespace-nowrap text-xs text-gray-500 hover:underline">기사 보기 ↗</Link>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <ContentPagination label="뉴스 페이지" page={page} totalPages={pages} href={pageHref} />
    </main>
  </div>;
}

export default function NewsPage() { return <Suspense fallback={<div className="p-6">뉴스를 불러오는 중…</div>}><NewsManager /></Suspense>; }
