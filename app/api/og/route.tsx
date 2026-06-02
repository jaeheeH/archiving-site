import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "edge";

const OG_SIZE = {
  width: 1200,
  height: 630,
};

const BRAND = "#ff4800";
const INK = "#f5f1eb";
const MUTED = "#a8a29a";
const LINE = "rgba(255,255,255,0.16)";
const CANVAS = "#0b0b0b";

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

function getOgSafeImageUrl(url: string | null | undefined, origin: string) {
  if (!url) return null;
  if (!url.includes("supabase.co")) return url;

  const cleanUrl = url.split("?")[0];
  const proxyUrl = new URL("/api/og-image", origin);
  proxyUrl.searchParams.set("src", cleanUrl);
  return proxyUrl.toString();
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

async function getBlogPayload(slug: string, origin: string): Promise<OgPayload | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select("title, subtitle, summary, title_image_url, thumbnail_url, category_id, published_at, created_at")
    .eq("type", "blog")
    .eq("is_published", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const category = await getCategoryName(data.category_id);

  return {
    section: "BLOG",
    label: category || "Article",
    title: data.title,
    description: data.summary || data.subtitle || "ARCH-B에서 기록한 최신 인사이트입니다.",
    imageUrl: getOgSafeImageUrl(data.thumbnail_url || data.title_image_url, origin),
    meta: formatDate(data.published_at || data.created_at),
    variant: "blog",
  };
}

async function getGalleryPayload(id: string, origin: string): Promise<OgPayload | null> {
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
    imageUrl: getOgSafeImageUrl(data.image_url, origin),
    meta: formatDate(data.created_at),
    variant: "gallery",
  };
}

async function getReferencePayload(id: string, origin: string): Promise<OgPayload | null> {
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
    description: data.description || "ARCH-B가 큐레이션한 디자인 레퍼런스입니다.",
    imageUrl: getOgSafeImageUrl(data.image_url || data.logo_url, origin),
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
      description: "개발 과정의 고민과 디자인적 발견을 기록합니다.",
      variant: "blog",
    };
  }

  return {
    section: "ARCH-B",
    label: "Archive Behind",
    title: "ARCH-B",
    description: "디자인 영감부터 개발 코드 조각까지, 크리에이터를 위한 구조화된 데이터베이스입니다.",
    variant: "default",
  };
}

async function getPayload(request: Request): Promise<OgPayload> {
  const { origin, searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const withoutImage = searchParams.get("image") === "0";

  const normalizePayload = (payload: OgPayload) =>
    withoutImage ? { ...payload, imageUrl: null } : payload;

  if (type === "blog") {
    const payload = await getBlogPayload(searchParams.get("slug") || "", origin);
    if (payload) return normalizePayload(payload);
  }

  if (type === "gallery") {
    const payload = await getGalleryPayload(searchParams.get("id") || "", origin);
    if (payload) return normalizePayload(payload);
  }

  if (type === "reference") {
    const payload = await getReferencePayload(searchParams.get("id") || "", origin);
    if (payload) return normalizePayload(payload);
  }

  return normalizePayload(getDefaultPayload(type));
}

function BackgroundGrid() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        opacity: 0.42,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    />
  );
}

function BrandMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div
        style={{
          display: "flex",
          width: 38,
          height: 38,
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${LINE}`,
          color: BRAND,
          fontSize: 20,
          fontWeight: 900,
        }}
      >
        A
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: INK, fontSize: 24, fontWeight: 900, letterSpacing: -1 }}>
          ARCH-B
        </span>
        <span style={{ color: MUTED, fontSize: 13, letterSpacing: 2 }}>
          ARCHIVE BEHIND
        </span>
      </div>
    </div>
  );
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
            "linear-gradient(135deg, rgba(255,72,0,0.22), rgba(255,255,255,0.05))",
          color: "rgba(255,255,255,0.16)",
          fontSize: 132,
          fontWeight: 900,
          letterSpacing: -8,
        }}
      >
        ARCH-B
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
        background: "#151515",
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

function OgCard({ payload }: { payload: OgPayload }) {
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
      <BackgroundGrid />
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
        <BrandMark />

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
          <span>{payload.meta || "ARCH-B"}</span>
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
  const response = new ImageResponse(<OgCard payload={payload} />, OG_SIZE);

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );

  return response;
}
