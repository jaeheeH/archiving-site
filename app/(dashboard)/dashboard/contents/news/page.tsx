"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import NewsPlacement from "./NewsPlacement";
import ContentPagination from "@/app/(dashboard)/components/ContentPagination";
import { useSearchParams } from "next/navigation";
import { CATEGORIES, FEEDS } from "@/lib/news-feeds";
import type { NewsPost } from "@/lib/news-record";
import type { NewsProcessStatus } from "@/lib/news-jobs";

function NewsManager() {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [queue, setQueue] = useState<NewsProcessStatus | null>(null);
  const [queueError, setQueueError] = useState("");
  const previousProgress = useRef<string | null>(null);
  const job = queue?.job;
  const jobActive = !!job && ['queued', 'collecting', 'writing'].includes(job.status);
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
    return () => controller.abort();
  }, [page, category, status, query, reload]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      let delay = 15000;
      try {
        const response = await fetch('/api/news/process', { signal: controller.signal, cache: 'no-store' });
        const data = await response.json() as NewsProcessStatus & { error?: string };
        if (!response.ok) throw new Error(data.error || '작성 상태를 불러오지 못했습니다.');
        if (controller.signal.aborted) return;
        setQueue(data); setQueueError('');
        const progress = JSON.stringify([data.job?.id, data.job?.status, data.job?.written, data.job?.failed, data.waiting, data.writing]);
        if (previousProgress.current !== null && previousProgress.current !== progress) setReload(value => value + 1);
        previousProgress.current = progress;
        if (data.writing || (data.job && ['queued', 'collecting', 'writing'].includes(data.job.status))) delay = 3000;
      } catch (cause) { if (!controller.signal.aborted) setQueueError(cause instanceof Error ? cause.message : '작성 상태를 불러오지 못했습니다.'); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, delay); }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [jobActive]);

  async function collect(withCollection = true) {
    setWorking("collect"); setNotice('서버에 자동 작성 작업을 요청하고 있습니다.'); setError("");
    try {
      const response = await fetch(withCollection ? "/api/news/collect" : "/api/news/process", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "자동 작성 작업을 시작하지 못했습니다.");
      setQueue(data); setReload(value => value + 1);
      setNotice('DB 작업 큐에 등록했습니다. 다른 페이지로 이동하거나 탭을 닫아도 서버가 한 편씩 이어서 처리합니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : "자동 작성 작업을 시작하지 못했습니다."); }
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
      <div><h1>뉴스 관리</h1><p className="mt-1 text-xs text-gray-500">수집부터 자료 조사·한국어 초안 작성까지 자동으로 진행합니다.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => collect(false)} disabled={!!working || jobActive || !queue || !!queueError} className="content-table-action">대기 뉴스 자동 작성</button><button type="button" onClick={() => collect()} disabled={!!working || jobActive || !queue || !!queueError} className="content-table-create">{working === "collect" ? "작업 요청 중…" : jobActive ? "서버에서 실행 중…" : "수집 + 자동 작성"}</button></div>
    </header>
    <main className="dashboard-container space-y-5">
      <section className="rounded-lg border border-gray-200 bg-white p-5" aria-label="뉴스 자동 작성">
        <h2 className="text-sm font-semibold">수집 → 참고자료 조사 → 기사 작성 → 사실 검수 → 초안 검토</h2>
        <p className="mt-2 text-xs leading-6 text-gray-500">공식 근거를 포함한 참고자료를 조사하고 1,800~3,000자 기사를 작성합니다. 한 번에 최대 15편을 처리하며, 이미 작성된 글은 덮어쓰지 않습니다. 발행은 검토 후 직접 진행합니다.</p>
        <p className="mt-1 text-xs leading-6 text-gray-500">수집과 기사 작성을 나누어 한 편씩 처리하고, 진행 상태를 DB에 저장합니다. 페이지 이동·탭 종료 후에도 이어지며 서버가 재시작되면 중단된 작업을 다시 가져갑니다. 로컬에서는 컴퓨터와 서버가 켜져 있어야 합니다.</p>
        <details className="mt-3 border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-sm font-medium">수집처 {FEEDS.length}곳 · 기사 품질 기준</summary>
          <p className="mt-2 text-xs leading-6 text-gray-500">최근 90일의 소식을 매체별 최대 20편씩 확인하고 중복을 제외합니다. 매체를 번갈아 조사하며, 기업의 주장·실제 출시 조건·성능 근거를 확인합니다. 서로 다른 참고자료 2개 이상과 공식 근거가 필요하며, 사실 검수에서 문제가 나오면 한 번 수정·재검수합니다. 통과한 초안도 발행 전 편집자의 검토가 필요합니다.</p>
          <ul className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">{FEEDS.map(feed => <li key={feed.id}><a href={feed.url} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">{feed.name} ↗</a><span className="ml-2 text-gray-500">{CATEGORIES[feed.category]}</span></li>)}</ul>
        </details>
        <p className="mt-3 text-sm text-gray-700">{queue ? `작성 대기 ${queue.waiting}편 · 진행 중 ${queue.writing}편 · 실패 기록 ${queue.failed}편` : '작성 상태를 확인하고 있습니다.'}</p>
        {queueError && <p role="alert" className="mt-2 text-sm text-red-700">{queueError} 작업 상태를 다시 확인하고 있습니다.</p>}
        {job && <div className="mt-4 border-t border-gray-100 pt-3 text-sm" role="status" aria-live="polite">
          <p className="font-medium">{job.status === 'queued' ? '작업 준비 중' : job.status === 'collecting' ? '새 뉴스 수집 중' : job.status === 'writing' ? '서버에서 조사·작성 중' : job.status === 'failed' ? '자동 작성 중단' : '자동 작성 완료'}</p>
          <p className="mt-1 text-gray-600">{job.withCollection && `새 뉴스 ${job.collected}편 수집 · `}초안 {job.written}편 작성 · 실패 {job.failed}편 · 최대 {job.limit}편 처리</p>
          {(job.processed > 0 || job.queued > 0) && <p className="mt-1 text-xs text-gray-500">이번 큐: {job.processed}편 처리 · {job.queued}편 대기</p>}
          {job.currentTitle && <p className="mt-2 text-xs text-gray-500">현재 작성: {job.currentTitle}</p>}
          {!!job.collectionErrors && <p className="mt-2 text-xs text-red-700">{job.collectionErrors}개 매체의 수집에 실패했습니다. 수집된 뉴스는 계속 처리합니다.</p>}
          {job.error && <p className="mt-2 text-xs text-red-700">{job.error}</p>}
        </div>}
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
