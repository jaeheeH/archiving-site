'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NewsSidebarBanner from '@/app/components/NewsSidebarBanner';
import { useToast } from '@/components/ToastProvider';
import { useImageUpload } from '@/hooks/useImageUpload';
import { DEFAULT_NEWS_BANNER, bannerImage, bannerIsVisible, type Banner, type BannerStats } from '@/lib/banners';
import TrendChart from '../../TrendChart';
import '@/app/css/news.css';
import '../../dashboard.css';

type Draft = Omit<Banner, 'id'>;
const dateInput = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 10) : '';
const ctr = (impressions: number, clicks: number) => impressions ? `${(clicks / impressions * 100).toFixed(2)}%` : '—';

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorError, setEditorError] = useState('');
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<BannerStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const latestFetch = useRef(0);
  const imageInput = useRef<HTMLInputElement>(null);
  const editorDialog = useRef<HTMLDialogElement>(null);
  const newBannerTrigger = useRef<HTMLButtonElement>(null);
  const { addToast } = useToast();
  const { uploadImage, uploading } = useImageUpload();
  const busy = saving || uploading;
  const editorOpen = form !== null;

  useEffect(() => {
    const dialog = editorDialog.current;
    if (!editorOpen || !dialog) return;
    const overflow = document.body.style.overflow;
    const opener = document.activeElement;
    const fallback = newBannerTrigger.current;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; if (opener && !opener.isConnected) fallback?.focus(); };
  }, [editorOpen]);

  function closeEditor() {
    if (!busy) { setForm(null); setEditing(null); }
  }

  const fetchBanners = useCallback(async () => {
    const request = ++latestFetch.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/settings/banners?days=${days}`, { cache: 'no-store' });
      const result = await response.json();
      if (request !== latestFetch.current) return;
      if (!response.ok) throw new Error(result.error || '배너를 불러오지 못했습니다.');
      setBanners(result.data || []); setStats(result.stats); setStatsError(result.statsError || ''); setError('');
    } catch (cause) { if (request === latestFetch.current) setError(cause instanceof Error ? cause.message : '배너를 불러오지 못했습니다.'); }
    finally { if (request === latestFetch.current) setLoading(false); }
  }, [days]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBanners();
  }, [fetchBanners]);

  function newBanner(useDefault = false) {
    setEditorError('');
    setEditing(null);
    setForm({ ...DEFAULT_NEWS_BANNER, ...(useDefault ? {} : { title: '', subtitle: '', label: '', image_url: '', link: '', kind: 'ad' as const }), order_index: banners.length ? Math.max(...banners.map(banner => banner.order_index)) + 1 : 0 });
  }
  function edit(banner: Banner) {
    setEditorError('');
    const { id, ...draft } = banner;
    setEditing(id); setForm(draft);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    setEditorError('');
    setSaving(true);
    try {
      const response = await fetch('/api/settings/banners', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, ...(editing ? { id: editing } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '배너를 저장하지 못했습니다.');
      await fetchBanners(); setForm(null); setEditing(null);
      addToast('배너를 저장했습니다. 공개 화면에 적용됩니다.', 'success');
    } catch (cause) { setEditorError(cause instanceof Error ? cause.message : '배너를 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  }
  async function remove(banner: Banner) {
    if (!confirm(`‘${banner.title}’ 배너를 삭제하시겠습니까?`)) return;
    setSaving(true);
    try {
      const response = await fetch('/api/settings/banners', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: banner.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '배너를 삭제하지 못했습니다.');
      if (editing === banner.id) { setForm(null); setEditing(null); }
      await fetchBanners(); addToast('배너를 삭제했습니다.', 'success');
    } catch (cause) { addToast(cause instanceof Error ? cause.message : '배너를 삭제하지 못했습니다.', 'error'); }
    finally { setSaving(false); }
  }
  async function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditorError('');
    const url = await uploadImage(file, 'banners', false);
    if (url) setForm(current => current && { ...current, image_url: url });
    else setEditorError('이미지를 업로드하지 못했습니다. JPG·PNG·WebP·GIF, 8MB 이하 파일을 확인해주세요.');
    if (imageInput.current) imageInput.current.value = '';
  }

  return <div className="operations-dashboard">
    <header className="dashboard-Header"><div><h1>광고 배너 관리</h1><p className="mt-1 text-xs text-gray-500">메인·뉴스 사이드바의 광고 이미지와 연결 주소를 관리합니다.</p></div><button ref={newBannerTrigger} type="button" className="content-table-create" disabled={busy || loading || !!error} onClick={() => newBanner()}>새 배너</button></header>
    <main className="dashboard-container space-y-5">
      <section className="rounded-lg border border-gray-200 bg-white p-5"><h2 className="text-sm font-semibold">노출 위치</h2><p className="mt-2 text-sm text-gray-600">뉴스 속 키워드(관심 주제) → 배너 → 함께 읽는 매체</p><p className="mt-2 text-xs leading-6 text-gray-500">권장 이미지 1000 × 400px · 5:2 비율 · 다른 비율은 가운데를 기준으로 잘립니다. 활성 상태이며 노출 기간에 해당하는 배너 중 한 개를 같은 확률로 랜덤 표시합니다. 광고만 이미지 왼쪽 아래에 AD를 표시합니다.</p></section>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" className="content-table-action ml-3" onClick={() => void fetchBanners()}>다시 불러오기</button></div>}
      <dialog ref={editorDialog} aria-labelledby="banner-editor-title" aria-describedby="banner-editor-description" className="fixed left-1/2 top-1/2 m-0 w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white p-0 text-gray-950 shadow-2xl backdrop:bg-black/50"
        onCancel={event => { event.preventDefault(); closeEditor(); }}
        onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeEditor(); }}>
        {form && <div className="flex max-h-[92dvh] flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div><h2 id="banner-editor-title" className="text-base font-semibold">{editing ? '배너 수정' : '새 배너 추가'}</h2><p id="banner-editor-description" className="mt-1 text-xs text-gray-500">이미지와 연결 주소를 설정합니다. 저장하면 공개 화면에 적용됩니다.</p></div>
            <button type="button" onClick={closeEditor} disabled={busy} aria-label="배너 편집 닫기" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-50"><i className="ri-close-line text-xl" aria-hidden="true" /></button>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-5"><section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]" aria-label="배너 편집">
        <form id="banner-editor-form" onSubmit={save}>
          {editorError && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{editorError}</p>}
          <fieldset disabled={busy} className="space-y-4">
            <div><label htmlFor="banner-title" className="mb-1 block text-sm font-medium">배너 이름 · 이미지 대체 설명</label><input id="banner-title" autoFocus required maxLength={160} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" /><p className="mt-1 text-xs text-gray-500">관리 목록과 접근성을 위한 설명입니다. 공개 화면에는 문구를 표시하지 않습니다.</p></div>
            <div><label htmlFor="banner-kind" className="mb-1 block text-sm font-medium">배너 유형</label><select id="banner-kind" value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as Banner['kind'] })} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"><option value="ad">광고 · AD 표시</option><option value="link">일반 링크 · AD 없음</option></select></div>
            <div><label htmlFor="banner-image" className="mb-1 block text-sm font-medium">이미지 주소</label><input id="banner-image" required inputMode="url" maxLength={2048} value={form.image_url} onChange={event => setForm({ ...form, image_url: event.target.value })} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="이미지를 업로드하거나 URL을 입력하세요" /><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="content-table-action" onClick={() => imageInput.current?.click()}>{uploading ? '업로드 중…' : '이미지 업로드'}</button><button type="button" className="content-table-action" onClick={() => setForm({ ...form, image_url: DEFAULT_NEWS_BANNER.image_url })}>기본 이미지 사용</button></div><input type="file" hidden ref={imageInput} onChange={chooseImage} accept="image/jpeg,image/png,image/webp,image/gif" aria-label="배너 이미지 파일" /></div>
            <div><label htmlFor="banner-link" className="mb-1 block text-sm font-medium">클릭 연결 주소</label><input id="banner-link" inputMode="url" maxLength={2048} value={form.link || ''} onChange={event => setForm({ ...form, link: event.target.value })} placeholder="/art 또는 https://example.com" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" /><p className="mt-1 text-xs text-gray-500">외부 주소는 새 탭으로 열립니다. 비워두면 링크를 연결하지 않습니다.</p></div>
            <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} />배너 노출</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.is_continuous} onChange={event => setForm({ ...form, is_continuous: event.target.checked })} />기간 제한 없이 노출</label></div>
            {!form.is_continuous && <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="banner-start" className="mb-1 block text-sm font-medium">시작일 · 한국 시간</label><input id="banner-start" type="date" value={dateInput(form.start_date)} onChange={event => setForm({ ...form, start_date: event.target.value || null })} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" /></div><div><label htmlFor="banner-end" className="mb-1 block text-sm font-medium">종료일 · 해당 날짜까지</label><input id="banner-end" type="date" min={dateInput(form.start_date)} value={dateInput(form.end_date)} onChange={event => setForm({ ...form, end_date: event.target.value || null })} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" /></div></div>}
            <div><label htmlFor="banner-order" className="mb-1 block text-sm font-medium">관리 목록 순서</label><input id="banner-order" type="number" min={0} max={9999} required value={form.order_index} onChange={event => setForm({ ...form, order_index: Number(event.target.value) })} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" /><p className="mt-1 text-xs text-gray-500">관리 목록 정렬에만 사용합니다. 공개 화면은 랜덤으로 표시합니다.</p></div>
          </fieldset>
        </form>
        <div className="self-start rounded-lg border border-gray-200 bg-white p-4"><h2 className="mb-4 text-sm font-semibold">공개 화면 미리보기</h2><p className="mb-4 border-b border-gray-200 pb-3 text-xs text-gray-500">뉴스 속 키워드</p>{bannerImage(form.image_url) ? <NewsSidebarBanner preview banner={{ ...form, id: editing || 'preview' }} /> : <div className="mb-5 flex aspect-[5/2] items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-500">이미지를 선택하면 여기에 표시됩니다.</div>}<p className="border-t border-gray-200 pt-3 text-xs text-gray-500">함께 읽는 매체</p></div>
      </section></div>
          <footer className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-4"><button type="button" disabled={busy} className="content-table-action" onClick={closeEditor}>취소</button><button type="submit" form="banner-editor-form" disabled={busy} className="content-table-create">{saving ? '저장 중…' : '저장'}</button></footer>
        </div>}
      </dialog>
      <section aria-label="등록된 광고 배너">
        <div className="content-table-meta mb-3 flex-wrap"><p>등록된 배너 {banners.length}개</p><div className="flex flex-wrap items-center gap-2"><label htmlFor="banner-days">통계 기간</label><select id="banner-days" disabled={busy} value={days} onChange={event => setDays(Number(event.target.value))} className="rounded-md border border-gray-200 px-3 py-2 text-sm"><option value={7}>최근 7일</option><option value={30}>최근 30일</option></select><button type="button" disabled={loading || busy} className="content-table-action" onClick={() => void fetchBanners()}>새로고침</button><a href="/" target="_blank" rel="noopener noreferrer" className="ml-2">사이트에서 보기 ↗</a></div></div>
        <div className="content-table-wrap" role="region" aria-label="배너 목록 가로 스크롤" tabIndex={0}>
          <table className="content-table content-table-banners text-left" aria-label={`등록된 배너 · 최근 ${days}일 통계`}>
            <thead><tr><th scope="col" className="content-table-title">배너</th><th scope="col" className="content-table-status">유형</th><th scope="col" className="content-table-status">노출 상태</th><th scope="col" className="content-table-date">노출 기간</th><th scope="col" className="content-table-count">노출수</th><th scope="col" className="content-table-count">클릭수</th><th scope="col" className="content-table-count">클릭률</th><th scope="col" className="content-table-action-cell">수정</th><th scope="col" className="content-table-action-cell">삭제</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="text-center text-sm text-gray-500">배너를 불러오는 중…</td></tr> : !banners.length ? <tr><td colSpan={9} className="text-center"><p className="text-sm text-gray-500">{error ? '배너 목록을 불러오지 못했습니다.' : '아직 등록된 광고 배너가 없습니다.'}</p><button type="button" disabled={!!error} onClick={() => newBanner(true)} className="content-table-create mt-4">기본 이미지로 시작</button></td></tr> : banners.map(banner => {
                const metric = stats?.banners.find(row => row.id === banner.id);
                const visible = bannerIsVisible(banner);
                return <tr key={banner.id} className="border-b hover:bg-gray-50">
                  <td className="content-table-title"><div className="flex min-w-0 items-center gap-3">
                    <div className="w-[100px] shrink-0 [&_.news-sidebar-ad]:mb-0"><NewsSidebarBanner preview banner={banner} /></div>
                    <div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold" title={banner.title}>{banner.title}</p><p className="mt-1 truncate text-xs text-gray-500" title={banner.link || '연결 없음'}>{banner.link || '연결 없음'}</p><p className="mt-1 text-xs text-gray-500">목록 순서 {banner.order_index}</p></div>
                  </div></td>
                  <td className="content-table-status text-sm">{banner.kind === 'ad' ? '광고' : '일반 링크'}</td>
                  <td className="content-table-status"><span className="content-table-badge" data-state={visible ? 'published' : 'draft'}>{!banner.is_active ? '숨김' : visible ? '랜덤 노출' : '기간 외'}</span></td>
                  <td className="content-table-date text-xs text-gray-500">{banner.is_continuous ? '기간 제한 없음' : <span className="whitespace-nowrap">{dateInput(banner.start_date) || '즉시'}<br />~ {dateInput(banner.end_date) || '제한 없음'}</span>}</td>
                  <td className="content-table-count text-sm font-medium tabular-nums">{stats ? (metric?.impressions || 0).toLocaleString() : '—'}</td>
                  <td className="content-table-count text-sm font-medium tabular-nums">{stats ? (metric?.clicks || 0).toLocaleString() : '—'}</td>
                  <td className="content-table-count text-sm tabular-nums">{stats ? ctr(metric?.impressions || 0, metric?.clicks || 0) : '—'}</td>
                  <td className="content-table-action-cell"><button type="button" disabled={busy} className="content-table-action" onClick={() => edit(banner)} aria-label={`${banner.title} 수정`}><i className="ri-edit-line" aria-hidden="true" />수정</button></td>
                  <td className="content-table-action-cell"><button type="button" disabled={busy} className="content-table-action content-table-action-danger" onClick={() => void remove(banner)} aria-label={`${banner.title} 삭제`}><i className="ri-delete-bin-line" aria-hidden="true" />삭제</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="배너 분석" className="space-y-4">
        <h2 className="text-base font-semibold">배너 분석 · 최근 {days}일</h2>
        <div className="grid gap-4 sm:grid-cols-3">{[{ label: '노출 수', value: stats?.totals.impressions.toLocaleString(), detail: '화면에 50% 이상 · 1초 이상 표시' }, { label: '클릭 수', value: stats?.totals.clicks.toLocaleString(), detail: '배너별 같은 IP · 한국 시간 하루 1회' }, { label: '클릭률 (CTR)', value: stats ? ctr(stats.totals.impressions, stats.totals.clicks) : null, detail: '클릭 수 ÷ 노출 수 × 100' }].map(metric => <article className="operation-card kpi-card" key={metric.label}><p className="kpi-label">{metric.label}</p><p className="kpi-number">{loading ? '…' : metric.value ?? '—'}</p><p className="kpi-detail">{metric.detail}</p></article>)}</div>
        <p className="text-xs leading-6 text-gray-500">광고·일반 링크 모두 운영 사이트에서 집계합니다. 미리보기·로컬 접속·봇·추적 거부는 제외하며, IP 원문은 저장하지 않습니다. 집계는 이 기능 적용 이후부터 시작됩니다.</p>
        {statsError && <p role="alert" className="text-sm text-red-600">{statsError}</p>}
        {!loading && stats && <section className="operation-card"><div className="operation-section-heading"><div><h2>일별 노출·클릭 추이</h2><p>최근 {days}일 · 한국 시간</p></div></div><div className="chart-legend"><span><i style={{ background: 'var(--archive-ink)' }} />노출</span><span><i style={{ background: 'var(--archive-brand)' }} />클릭</span></div><TrendChart mode="banners" daily={stats.daily.map(day => ({ ...day, registered: 0, published: 0, views: null }))} /></section>}
      </section>
    </main>
  </div>;
}
