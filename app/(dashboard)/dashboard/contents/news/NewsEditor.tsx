"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import Link from "next/link";
import { CATEGORIES } from "@/lib/news-feeds";
import type { NewsPost } from "@/lib/news-record";
import { editorialText, type Editorial } from "@/lib/news-editorial";
import type { ResearchResult } from "@/lib/news-research";
import { useImageUpload } from "@/hooks/useImageUpload";
import ArchiveImage from "@/app/components/ArchiveImage";
import NewsBlocksEditor from './NewsBlocksEditor';
import type { NewsContentBlock } from '@/lib/news-content-blocks';

const fieldClass = "w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm leading-6 focus:border-gray-500";

export default function NewsEditor({ postId }: { postId: string }) {
  const [post, setPost] = useState<NewsPost | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [points, setPoints] = useState("");
  const [tags, setTags] = useState("");
  const [paragraphs, setParagraphs] = useState<Editorial["paragraphs"]>([]);
  const [blocks, setBlocks] = useState<NewsContentBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [researching, setResearching] = useState(false);
  const [preview, setPreview] = useState<ResearchResult | null>(null);
  const [prepared, setPrepared] = useState<ResearchResult | null>(null);
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailCredit, setThumbnailCredit] = useState('');
  const [thumbnailChanged, setThumbnailChanged] = useState(false);
  const { uploadImage, uploading } = useImageUpload();
  const [loadingBodyImage, setLoadingBodyImage] = useState(false);
  const imageBusy = uploading || loadingBodyImage;
  useUnsavedChanges(dirty);

  async function research() {
    if (busy || researching || imageBusy) return;
    setResearching(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/news/${postId}/research`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '자료 조사에 실패했습니다.');
      setPreview(result);
      setNotice('검토용 초안을 생성했습니다. 내용을 확인한 후 편집기로 가져오세요.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '자료 조사에 실패했습니다.'); }
    finally { setResearching(false); }
  }
  function applyPreview() {
    if (!preview || busy || researching || imageBusy) return;
    if (dirty && !confirm('편집 중인 내용을 조사 초안으로 바꿀까요?')) return;
    const article = preview.article;
    setTitle(article.title); setSummary(article.summary); setPoints(article.points.join('\n')); setTags(article.tags.join(', ')); setParagraphs(article.paragraphs); setBlocks(article.blocks || []); setDirty(true); setPreview(null);
    setNotice('초안을 편집기로 가져왔습니다. 검토 후 저장하거나 발행하세요.');
  }


  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/posts/${postId}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "뉴스를 불러오지 못했습니다.");
      const row = data.data as NewsPost & { type: string };
      if (row.type !== "news" || row.content?.format !== "archb-news-v1") throw new Error("뉴스를 찾을 수 없습니다.");
      setPost(row); setTitle(row.title); setSummary(row.summary || ""); setPoints((row.content.points || []).join("\n")); setTags((row.tags || []).join(", ")); setParagraphs(row.content.paragraphs || []);
      setBlocks(row.content.blocks || []);
      setThumbnailUrl(row.thumbnail_url || ''); setThumbnailCredit(row.content.thumbnail_credit || ''); setThumbnailChanged(false);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    fetch(`/api/news/${postId}/research`, { signal: controller.signal }).then(async response => {
      if (response.ok) setPrepared((await response.json()).prepared);
    }).catch(() => {});
    return () => controller.abort();
  }, [postId]);

  function updateSection(index: number, value: Editorial["paragraphs"][number]) { setDirty(true); setParagraphs(previous => previous.map((section, i) => i === index ? value : section)); }
  function removeSection(index: number) {
    setDirty(true);
    setParagraphs(previous => previous.filter((_, i) => i !== index));
    setBlocks(previous => previous.filter(block => block.afterSection !== index).map(block => block.afterSection > index ? { ...block, afterSection: block.afterSection - 1 } : block));
  }

  async function uploadThumbnail(event: ChangeEvent<HTMLInputElement>) {
    event.stopPropagation();
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || researching || imageBusy) return;
    const url = await uploadImage(file, `news-thumbnails/${postId}`, false);
    if (url) { setThumbnailUrl(url); setThumbnailCredit(''); setThumbnailChanged(true); setDirty(true); setNotice('썸네일을 준비했습니다. 저장하면 목록에 반영됩니다.'); }
  }

  async function uploadBodyImage(file: File) {
    if (busy || researching || imageBusy) return null;
    setLoadingBodyImage(true); setError('');
    try {
      const src = await uploadImage(file, `news-body/${postId}`, false);
      if (!src) return null;
      const image = new window.Image(); image.src = src; await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid image dimensions');
      return { src, width: image.naturalWidth, height: image.naturalHeight };
    } catch { setError('이미지를 읽지 못했습니다. 파일을 확인한 뒤 다시 업로드해주세요.'); return null; }
    finally { setLoadingBodyImage(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post || busy || researching || imageBusy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const isPublished = submitter ? submitter.value === "published" : post.is_published;
    const article = {
      url: post.content.source_url, title, summary, blocks,
      points: points.split("\n").map(value => value.trim()).filter(Boolean),
      tags: tags.split(",").map(value => value.trim()).filter(Boolean),
      paragraphs: paragraphs.map(section => typeof section === "string" ? section : { ...section, paragraphs: section.paragraphs.flatMap(text => text.split(/\n\s*\n/)).map(text => text.trim()).filter(Boolean) }),
    };
    setBusy(true); setNotice(""); setError(""); setIssues([]);
    try {
      const response = await fetch(`/api/news/${postId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ article, is_published: isPublished, ...(thumbnailChanged ? { thumbnail_url: thumbnailUrl || null, thumbnail_credit: thumbnailCredit } : {}) }) });
      const result = await response.json();
      if (!response.ok) { setIssues(result.issues || []); throw new Error(result.error || "저장하지 못했습니다."); }
      setDirty(false);
      setPost({ ...post, title, is_published: isPublished, ...(thumbnailChanged ? { thumbnail_url: thumbnailUrl || null } : {}) });
      setThumbnailChanged(false);
      setNotice(isPublished ? "발행된 기사에 변경사항을 저장했습니다." : "미발행 상태로 저장했습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <div>
    <header className="dashboard-Header"><div><h1>뉴스 편집</h1><p className="mt-1 text-xs text-gray-500">한국어 본문과 참고자료를 정리합니다.</p></div><Link href="/dashboard/contents/news" className="content-table-action">목록으로</Link></header>
    <main className="dashboard-container">
      {!post ? <p role={error ? "alert" : "status"} className="text-sm text-gray-500">{error || "뉴스를 불러오는 중…"}</p> : <form onSubmit={save} onChange={() => setDirty(true)} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          <aside className="rounded-lg border border-border p-4 text-sm leading-7"><h2 className="font-semibold">발행 전 편집 확인</h2><p className="mt-2 text-muted-foreground">제목에서 누가 무엇을 바꿨는지 바로 알 수 있게 써주세요. 같은 주제의 여러 자료를 한 흐름의 기사로 엮고, 확인된 사실은 “이렇게 제작했다·진행했다”처럼 직접 서술합니다. “자료에 따르면” 같은 출처 소개는 반복하지 않으며 출처는 공개 화면 하단에 모읍니다. 본문은 900~4,000자·3~8개 섹션 안에서 작성하며, 근거가 충분하면 2,600~3,600자를 목표로 배경·진행 과정·구성과 의미를 자세히 설명합니다. 상단 요약으로 핵심 결론을 먼저 전하고, 본문은 배경·핵심 내용·짧은 정리·ARCH.B 의견 순서로 전개합니다. 관련 문단에만 내용 중심의 소제목을 붙이고 도입·정리의 제목은 비워둘 수 있습니다. 같은 요약이나 일반론을 반복하지 않습니다. 사실·업체의 주장·ARCH.B의 해석을 구분하고 직접 해보지 않은 시험·취재를 경험담으로 쓰지 않습니다.</p></aside>
          {preview && <section className="space-y-5 rounded-lg border border-emerald-200 bg-white p-5" aria-label="조사 초안 검토">
            <div><h2 className="text-lg font-semibold">조사 초안 검토</h2><p className="mt-1 text-xs text-gray-500">{preview.research.model} · 본문 {preview.research.characterCount}자 · 참고자료 {preview.research.sources.length}개</p></div>
            <h3 className="text-xl font-bold">{preview.article.title}</h3><p className="text-sm leading-7 text-gray-600">{preview.article.summary}</p>
            <div className="max-h-[600px] space-y-6 overflow-y-auto border-y py-5" tabIndex={0} aria-label="초안 본문">{preview.article.paragraphs.map((section, index) => typeof section === 'string' ? <p key={index}>{section}</p> : <section key={index}><p className="text-xs text-emerald-700">{section.kind === 'analysis' ? 'ARCH.B 분석' : '사실·소식'}</p><h4 className="mt-2 font-semibold">{section.heading}</h4>{section.paragraphs.map((text, i) => <p key={i} className="mt-3 text-sm leading-7">{text}</p>)}<div className="mt-3 flex flex-wrap gap-3">{section.references.map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 underline">{reference.label} ↗</a>)}</div></section>)}</div>
            <details className="text-sm"><summary className="cursor-pointer font-medium">참고자료와 근거</summary>{preview.research.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="my-2 block break-words text-xs text-emerald-700 underline">{source.label} ↗</a>)}</details>
            <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || researching || imageBusy} onClick={applyPreview} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">편집기로 가져오기</button><button type="button" onClick={() => setPreview(null)} className="rounded-md border px-4 py-2 text-sm">초안 닫기</button></div>
          </section>}

          <section className="space-y-5 rounded-lg border border-gray-200 bg-white p-5">
            <label className="block text-sm font-medium">한국어 제목<input className={`${fieldClass} mt-2`} value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required /></label>
            <label className="block text-sm font-medium">요약<textarea className={`${fieldClass} mt-2`} value={summary} onChange={event => setSummary(event.target.value)} maxLength={350} rows={3} /></label>
            <label className="block text-sm font-medium">핵심 요약<textarea className={`${fieldClass} mt-2`} value={points} onChange={event => setPoints(event.target.value)} rows={4} placeholder="한 줄에 하나씩 입력하세요. 발행 시 2~4개가 필요합니다." /></label>
            <label className="block text-sm font-medium">키워드<input className={`${fieldClass} mt-2`} value={tags} onChange={event => setTags(event.target.value)} placeholder="쉼표로 구분 · 최대 5개" /></label>
          </section>
          <section className="space-y-5 rounded-lg border border-gray-200 bg-white p-5">
            <div><h2 className="text-base font-semibold">기사 본문</h2><p className="mt-1 text-xs leading-5 text-gray-500">본문 900~4,000자 · 3~8개 섹션 · 원출처 포함 참고자료 2개 이상. 섹션 제목은 입력한 곳만 공개됩니다. “서론·본론·결론” 대신 내용을 설명하는 제목을 쓰고, 묶을 필요가 없으면 비워두세요. 마지막에는 ARCH.B 의견을 적습니다. 글의 성격·참고자료 연결은 내부 검수용입니다. 문단은 빈 줄로 나눕니다.</p><p className="mt-2 text-xs text-gray-500">현재 {editorialText(paragraphs).length}자 · {paragraphs.length}개 섹션</p></div>
            {paragraphs.map((section, index) => <fieldset key={index} disabled={busy || researching || imageBusy} className="min-w-0 space-y-4 rounded-md border border-gray-200 p-4">
              <legend className="px-1 text-sm font-semibold">본문 {index + 1}</legend>
              {typeof section !== "string" && <>
                <label className="block text-sm">섹션 제목 (선택)<input className={`${fieldClass} mt-1`} value={section.heading} onChange={event => updateSection(index, { ...section, heading: event.target.value })} maxLength={80} /></label>
                <label className="block text-sm">글의 성격<select className={`${fieldClass} mt-1`} value={section.kind} onChange={event => updateSection(index, { ...section, kind: event.target.value as "reporting" | "analysis" })}><option value="reporting">사실·소식</option><option value="analysis">ARCH.B 의견·해석</option></select></label>
              </>}
              <label className="block text-sm">본문 내용<textarea className={`${fieldClass} mt-1`} value={typeof section === "string" ? section : section.paragraphs.join("\n\n")} onChange={event => updateSection(index, typeof section === "string" ? event.target.value : { ...section, paragraphs: [event.target.value] })} rows={7} /></label>
              {typeof section !== "string" && <div className="space-y-3">
                {section.references.map((reference, refIndex) => <div key={refIndex} className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">참고자료 이름<input className={`${fieldClass} mt-1`} value={reference.label} maxLength={100} onChange={event => updateSection(index, { ...section, references: section.references.map((ref, i) => i === refIndex ? { ...ref, label: event.target.value } : ref) })} /></label>
                  <label className="text-xs">참고자료 URL<input className={`${fieldClass} mt-1`} type="url" value={reference.url} maxLength={2000} placeholder="https://" onChange={event => updateSection(index, { ...section, references: section.references.map((ref, i) => i === refIndex ? { ...ref, url: event.target.value } : ref) })} /></label>
                  <label className="text-xs">자료 성격<select className={`${fieldClass} mt-1`} value={reference.kind || "reporting"} onChange={event => updateSection(index, { ...section, references: section.references.map((ref, i) => i === refIndex ? { ...ref, kind: event.target.value as "primary" | "reporting" } : ref) })}><option value="reporting">보도·참고자료</option><option value="primary">공식 1차 자료 · 확인함</option></select></label>
                  <button type="button" className="self-end px-2 py-3 text-xs text-gray-500" aria-label={`본문 ${index + 1} 참고자료 ${refIndex + 1} 제거`} onClick={() => updateSection(index, { ...section, references: section.references.filter((_, i) => i !== refIndex) })}>제거</button>
                </div>)}
                {section.references.length < 9 && <button type="button" className="text-xs font-medium text-emerald-700" onClick={() => updateSection(index, { ...section, references: [...section.references, { label: "", url: "", kind: "reporting" }] })}>+ 참고자료 추가</button>}
              </div>}
              <NewsBlocksEditor blocks={blocks.filter(block => block.afterSection === index)} afterSection={index} disabled={busy || researching || imageBusy} uploadImage={uploadBodyImage} onChange={next => { setDirty(true); setBlocks(previous => [...previous.filter(block => block.afterSection !== index), ...next]); }} />
              <button type="button" className="text-xs text-red-600" onClick={() => removeSection(index)}>본문 {index + 1} 제거</button>
            </fieldset>)}
            {paragraphs.length < 12 && <button type="button" disabled={busy || researching || imageBusy} className="rounded-md border border-gray-200 px-4 py-2 text-sm" onClick={() => { setDirty(true); setParagraphs(previous => [...previous, { heading: "", kind: "reporting", paragraphs: [""], references: [] }]); }}>+ 본문 섹션 추가</button>}
          </section>
        </div>
        <aside className="space-y-5">
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">발행 관리</h2><p className="text-sm text-gray-500">현재 상태: <strong className="text-gray-900">{post.is_published ? "발행" : "미발행"}</strong></p>
            {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
            {issues.length > 0 && <ul className="space-y-2 text-xs text-red-700">{issues.map((issue, i) => <li key={i}>{issue.field}: {issue.message}</li>)}</ul>}
            {notice && <p role="status" className="text-sm leading-6 text-emerald-700">{notice}</p>}
            <button type="submit" value={post.is_published ? "published" : "draft"} disabled={busy || researching || imageBusy} className="content-table-create w-full">{busy ? "저장 중…" : post.is_published ? "변경사항 저장" : "임시저장"}</button>
            <button type="submit" value={post.is_published ? "draft" : "published"} disabled={busy || researching || imageBusy} className="content-table-action w-full">{post.is_published ? "비공개로 저장" : "발행"}</button>
            {post.is_published && <Link href={`/news/read/${post.slug}`} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-emerald-700">기사 보기 ↗</Link>}
          </section>
          <section aria-label="목록 썸네일" className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold">목록 썸네일</h2>
            <p className="text-xs leading-6 text-gray-500">원본 이미지가 있으면 목록과 상세에 그대로 사용합니다. 원본이 없는 기사만 아래 썸네일을 목록에 표시하며, 상세 본문에는 넣지 않습니다.</p>
            {post.title_image_url && <div><p className="mb-2 text-xs font-medium">현재 원본 이미지 · 우선 사용</p><ArchiveImage src={post.title_image_url} width={600} height={400} sizes="280px" alt="현재 기사 원본 이미지" className="h-auto w-full rounded-md" /></div>}
            {thumbnailUrl && <div><p className="mb-2 text-xs font-medium">별도 썸네일</p><ArchiveImage src={thumbnailUrl} width={600} height={400} sizes="280px" alt="원본 이미지가 없을 때 사용할 목록 썸네일" className="h-auto w-full rounded-md" /></div>}
            <label className="block text-xs font-medium">별도 썸네일 업로드<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy || researching || imageBusy} onChange={uploadThumbnail} className="mt-2 block w-full text-xs" /></label>
            <p className="text-xs leading-5 text-gray-500">JPG·PNG·WebP·GIF, 8MB 이하. 저장해야 반영됩니다.</p>
            {imageBusy && <p role="status" className="text-xs">이미지 업로드 중…</p>}
            {thumbnailUrl && <><label className="block text-xs">썸네일 출처<input className={`${fieldClass} mt-1`} value={thumbnailCredit} maxLength={200} placeholder="예: ARCH.B · AI 생성" onChange={event => { setThumbnailCredit(event.target.value); setThumbnailChanged(true); setDirty(true); }} /></label><button type="button" disabled={busy || researching || imageBusy} className="content-table-action" onClick={() => { setThumbnailUrl(''); setThumbnailCredit(''); setThumbnailChanged(true); setDirty(true); }}>별도 썸네일 제거</button></>}
          </section>
          <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5"><h2 className="text-sm font-semibold">자료 조사·초안 생성</h2><p className="text-xs leading-6 text-gray-500">공식 자료를 우선 조사하고 검토용 초안을 만듭니다. 초안 생성만으로 현재 기사가 바뀌지 않습니다.</p>{prepared && <button type="button" disabled={busy || researching || imageBusy} onClick={() => setPreview(prepared)} className="w-full rounded-md border border-emerald-300 px-4 py-2.5 text-sm text-emerald-700 disabled:opacity-50">보강 초안 검토 · {prepared.research.characterCount}자</button>}<button type="button" onClick={research} disabled={busy || researching || imageBusy} className="w-full rounded-md border border-gray-200 px-4 py-2.5 text-sm disabled:opacity-50">{researching ? '자료 조사 중…' : '자료 조사·초안 생성'}</button></section>
          <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5"><h2 className="text-sm font-semibold">원출처</h2><p className="text-xs text-gray-500">{CATEGORIES[post.content.category]} · {post.content.source}</p><a href={post.content.source_url} target="_blank" rel="noopener noreferrer" className="block break-words text-sm text-emerald-700 hover:underline">{post.content.original_title} ↗</a>{post.content.source_text && <details className="text-xs leading-6 text-gray-500"><summary className="cursor-pointer">수집한 원문 요약</summary><p className="mt-2 whitespace-pre-wrap">{post.content.source_text}</p></details>}</section>
        </aside>
      </form>}
    </main>
  </div>;
}
