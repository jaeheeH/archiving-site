/* eslint-disable @next/next/no-img-element -- ImageResponse renders img nodes into PNG rather than a web page. */
import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readOgImage } from '@/lib/og-image';
import { getSiteSettings } from '@/lib/site-settings';

export const runtime = "nodejs";
const logo = readFile(join(process.cwd(), 'public/logo.png')).then(bytes => `data:image/png;base64,${bytes.toString('base64')}`);


const OG_SIZE = {
  width: 1200,
  height: 630,
};

const BRAND = "#1a8917";
const INK = "#242424";
const MUTED = "#6b6b6b";
const LINE = "#dedede";
const CANVAS = "#ffffff";

type OgPayload = {
  section: string;
  label: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  meta?: string | null;
  domain?: string | null;
  variant?: "default" | "blog" | "gallery" | "reference";
};

function truncate(value: string | null | undefined, max: number) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function getOgSafeImageUrl(url: string | null | undefined) {
  if (!url) return null;
  return url;
}

async function getCategoryName(categoryId: string | null | undefined) {
  if (!categoryId) return null;

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();

  return data?.name || null;
}

async function getBlogPayload(slug: string): Promise<OgPayload | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select("type,title,subtitle,summary,title_image_url,thumbnail_url,category_id,published_at,created_at")
    .in("type", ["blog", "news"])
    .eq("is_published", true)
    .not('published_at', 'is', null)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const category = await getCategoryName(data.category_id);

  return {
    section: data.type === "news" ? "NEWS" : "EDITORIAL",
    label: data.type === "news" ? "뉴스" : category || "에디토리얼",
    title: data.title,
    description: data.summary || data.subtitle || "ARCH.B에서 기록한 최신 인사이트입니다.",
    imageUrl: getOgSafeImageUrl(data.thumbnail_url || data.title_image_url),
    meta: formatDate(data.published_at || data.created_at),
    variant: "blog",
  };
}

async function getGalleryPayload(id: string): Promise<OgPayload | null> {
  const galleryId = Number(id);
  if (!Number.isFinite(galleryId)) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("gallery")
    .select("title, description, gemini_description, image_url, category, created_at")
    .eq("id", galleryId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    section: "GALLERY",
    label: data.category || "Image",
    title: data.title,
    description: data.description || data.gemini_description || "텍스트로 그려낸 상상의 단면을 기록합니다.",
    imageUrl: getOgSafeImageUrl(data.image_url),
    meta: formatDate(data.created_at),
    variant: "gallery",
  };
}

async function getReferencePayload(id: string): Promise<OgPayload | null> {
  const referenceId = Number(id);
  if (!Number.isFinite(referenceId)) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("references")
    .select("title, description, url, image_url, logo_url, category, range")
    .eq("id", referenceId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    section: "REFERENCE",
    label: data.range?.[0] || data.category || "Reference",
    title: data.title,
    description: data.description || "ARCH.B가 큐레이션한 디자인 레퍼런스입니다.",
    imageUrl: getOgSafeImageUrl(data.image_url || data.logo_url),
    domain: getDomain(data.url),
    variant: "reference",
  };
}

function getDefaultPayload(type: string | null): OgPayload {
  if (type === "gallery-list") {
    return {
      section: "GALLERY",
      label: "Generative Archive",
      title: "Generative Archive",
      description: "텍스트로 그려낸 상상의 단면들을 기록합니다.",
      variant: "gallery",
    };
  }

  if (type === "references-list") {
    return {
      section: "REFERENCE",
      label: "Directory",
      title: "References",
      description: "디자인, 개발, 마케팅 등 다양한 분야의 영감을 주는 사이트들을 모았습니다.",
      variant: "reference",
    };
  }

  if (type === "blog-list") {
    return {
      section: "BLOG",
      label: "Magazine",
      title: "Blog",
      description: "만드는 동안 마주한 질문과 선택, 결과물 뒤의 이야기를 기록합니다.",
      variant: "blog",
    };
  }

  return {
    section: "ARCH.B",
    label: "Archive Behind",
    title: "ARCH.B",
    description: "디자인 영감부터 개발 코드 조각까지, 크리에이터를 위한 구조화된 데이터베이스입니다.",
    variant: "default",
  };
}

async function getPayload(request: Request): Promise<OgPayload> {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const withoutImage = searchParams.get("image") === "0";

  const normalizePayload = (payload: OgPayload) =>
    withoutImage ? { ...payload, imageUrl: null } : payload;

  if (type === "blog" || type === "news" || type === "article") {
    const payload = await getBlogPayload(searchParams.get("slug") || "");
    if (payload) return normalizePayload(payload);
  }

  if (type === "gallery") {
    const payload = await getGalleryPayload(searchParams.get("id") || "");
    if (payload) return normalizePayload(payload);
  }

  if (type === "reference") {
    const payload = await getReferencePayload(searchParams.get("id") || "");
    if (payload) return normalizePayload(payload);
  }

  return normalizePayload(getDefaultPayload(type));
}

function BrandMark({ logoUrl }: { logoUrl: string }) {
  return <div style={{ display: 'flex', alignItems: 'center' }}><img src={logoUrl} alt="ARCH-B" width={176} height={32} style={{ objectFit: 'contain' }} /></div>;
}

function ImagePanel({ payload }: { payload: OgPayload }) {
  if (!payload.imageUrl) {
    return (
      <div
        style={{
          display: "flex",
          flex: 1,
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          borderLeft: `1px solid ${LINE}`,
          background:
            "#f5f5f2",
          color: "#dedede",
          fontSize: 132,
          fontWeight: 900,
          letterSpacing: -8,
        }}
      >
        ARCH.B
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flex: 1,
        height: "100%",
        overflow: "hidden",
        borderLeft: `1px solid ${LINE}`,
        background: "#f5f5f2",
      }}
    >
      <img
        src={payload.imageUrl}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: payload.variant === "gallery" ? "contain" : "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            payload.variant === "gallery"
              ? "linear-gradient(90deg, rgba(11,11,11,0.2), rgba(11,11,11,0))"
              : "linear-gradient(90deg, rgba(11,11,11,0.08), rgba(11,11,11,0.24))",
        }}
      />
    </div>
  );
}

function OgCard({ payload, logoUrl }: { payload: OgPayload; logoUrl: string }) {
  const hasImage = Boolean(payload.imageUrl);
  const imageWidth = payload.variant === "gallery" ? 520 : 470;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: CANVAS,
        color: INK,
        fontFamily:
          'Arial, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
      }}
    >

      <div
        style={{
          position: "relative",
          display: "flex",
          width: hasImage ? OG_SIZE.width - imageWidth : OG_SIZE.width,
          height: "100%",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "58px 64px",
        }}
      >
        <BrandMark logoUrl={logoUrl} />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                display: "flex",
                color: BRAND,
                fontSize: 18,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              {truncate(payload.label, 28)}
            </span>
            <span style={{ display: "flex", width: 72, height: 1, background: LINE }} />
            <span style={{ color: MUTED, fontSize: 16, fontWeight: 700 }}>
              {payload.section}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              color: INK,
              fontSize: hasImage ? 56 : 72,
              fontWeight: 950,
              lineHeight: 1.08,
              letterSpacing: -2.4,
              maxHeight: hasImage ? 190 : 246,
              overflow: "hidden",
            }}
          >
            {truncate(payload.title, hasImage ? 54 : 68)}
          </div>

          <div
            style={{
              display: "flex",
              color: MUTED,
              fontSize: 24,
              lineHeight: 1.45,
              maxHeight: 104,
              overflow: "hidden",
            }}
          >
            {truncate(payload.description, hasImage ? 96 : 132)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            paddingTop: 24,
            borderTop: `1px solid ${LINE}`,
            color: MUTED,
            fontSize: 18,
          }}
        >
          <span>{payload.domain || "archbehind.com"}</span>
          <span>{payload.meta || "ARCH.B"}</span>
        </div>
      </div>

      {hasImage && (
        <div style={{ display: "flex", width: imageWidth, height: "100%" }}>
          <ImagePanel payload={payload} />
        </div>
      )}
    </div>
  );
}

export async function GET(request: Request) {
  const payload = await getPayload(request);
  if (!payload.imageUrl && new URL(request.url).searchParams.get('type') === 'default') {
    const custom = (await getSiteSettings())?.og_image;
    if (custom) {
      const bytes = await readOgImage(custom).then(data => sharp(data).resize(1200, 630, { fit: 'contain', background: '#ffffff' }).png().toBuffer()).catch(() => null);
      if (bytes) return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
    }
  }
  if (payload.imageUrl) payload.imageUrl = await readOgImage(payload.imageUrl).then(bytes => `data:image/jpeg;base64,${bytes.toString('base64')}`).catch(() => null);
  const logoUrl = await logo;
  const render = (card: OgPayload) => new ImageResponse(<OgCard payload={card} logoUrl={logoUrl} />, OG_SIZE).arrayBuffer();
  // Finish rendering before committing HTTP headers, including failures inside the image stream.
  const bytes = await render(payload).catch(() => render({ ...payload, imageUrl: null }));
  return new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600' } });
}
