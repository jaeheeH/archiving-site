import { NextResponse } from "next/server";
import { createClient } from "./server";
import { createAdminClient } from "./admin";

const MAX_GALLERY_TEXT_LENGTH = 800;
const MAX_GALLERY_TITLE_LENGTH = 160;
const MAX_GALLERY_TAGS = 20;
const MAX_GALLERY_TAG_LENGTH = 40;
const MAX_GALLERY_RANGE = 6;
const MAX_GALLERY_DIMENSION = 65535;
const MAX_EMBEDDING_VALUES = 4096;
const GALLERY_STORAGE_MARKER = "/storage/v1/object/public/gallery/";

type StorageErrorLike = {
  status?: number | string;
  statusCode?: number | string;
  message?: string;
};

export function normalizeGalleryText(value: unknown, max = MAX_GALLERY_TEXT_LENGTH) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function normalizeGalleryTitle(value: unknown) {
  return normalizeGalleryText(value, MAX_GALLERY_TITLE_LENGTH);
}

export function normalizeGalleryUrl(value: unknown) {
  const url = normalizeGalleryText(value, 2048);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function extractGalleryStoragePath(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl);
    const markerIndex = url.pathname.indexOf(GALLERY_STORAGE_MARKER);
    if (markerIndex < 0) return null;

    return decodeURIComponent(url.pathname.slice(markerIndex + GALLERY_STORAGE_MARKER.length));
  } catch {
    const fallbackPath = imageUrl
      .split("/gallery/")
      .pop()
      ?.split("?")[0]
      ?.split("#")[0];

    return fallbackPath || null;
  }
}

export function isSafeGalleryStoragePath(value: string) {
  return (
    value.length <= 512 &&
    !value.startsWith("/") &&
    !value.includes("..") &&
    /^[a-zA-Z0-9._/-]+$/.test(value)
  );
}

export function isStorageNotFoundError(error: unknown) {
  const storageError = error as StorageErrorLike;
  const status = Number(storageError.statusCode ?? storageError.status ?? 0);

  return status === 404 || /not found/i.test(storageError.message || "");
}

export async function removeGalleryStorageAssets(
  admin: ReturnType<typeof createAdminClient>,
  urls: Array<string | null | undefined>
) {
  const paths = Array.from(
    new Set(
      urls
        .map(extractGalleryStoragePath)
        .filter((path): path is string => Boolean(path))
    )
  );

  if (paths.length === 0) {
    return { removed: [], skipped: [] };
  }

  const safePaths = paths.filter(isSafeGalleryStoragePath);
  const skipped = paths.filter((path) => !isSafeGalleryStoragePath(path));

  if (safePaths.length === 0) {
    return { removed: [], skipped };
  }

  let { error } = await admin.storage.from("gallery").remove(safePaths);

  if (error && !isStorageNotFoundError(error)) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const retry = await admin.storage.from("gallery").remove(safePaths);
    error = retry.error;
  }

  if (error && !isStorageNotFoundError(error)) {
    throw error;
  }

  return {
    removed: error ? [] : safePaths,
    skipped,
  };
}

export function normalizeGalleryTags(value: unknown, maxCount = MAX_GALLERY_TAGS) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, MAX_GALLERY_TAG_LENGTH))
        .filter(Boolean)
    )
  ).slice(0, maxCount);
}

export function normalizeGalleryRange(value: unknown) {
  return normalizeGalleryTags(value, MAX_GALLERY_RANGE);
}

export function normalizeGalleryDimension(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > MAX_GALLERY_DIMENSION) return null;
  return numeric;
}

export function normalizeGalleryEmbedding(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (!Array.isArray(value) || value.length > MAX_EMBEDDING_VALUES) return null;
  return value.every((item) => typeof item === "number" && Number.isFinite(item)) ? value : null;
}

/**
 * 현재 사용자의 role 확인
 * admin, sub-admin, editor 권한이 있는지 체크
 */
export async function checkGalleryEditPermission() {
  try {
    const supabase = await createClient();

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        userId: null,
        role: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    // users 테이블에서 role 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = userData?.role;
    const isEditor = ["admin", "sub-admin", "editor"].includes(role);

    if (!isEditor) {
      return {
        authorized: false,
        userId: user.id,
        role,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return {
      authorized: true,
      userId: user.id,
      role,
      error: null,
    };
  } catch (error) {
    console.error("❌ 권한 검증 에러:", error);
    return {
      authorized: false,
      userId: null,
      role: null,
      error: NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      ),
    };
  }
}

/**
 * 현재 사용자가 특정 gallery의 작성자인지 또는 관리자인지 확인
 */
export async function checkGalleryOwnershipOrAdmin(galleryId: number) {
  try {
    const supabase = await createClient();

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    // users 테이블에서 role 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = userData?.role;
    const isAdmin = ["admin", "sub-admin"].includes(role);

    // admin/sub-admin이면 권한 있음
    if (isAdmin) {
      return { authorized: true, error: null };
    }

    // gallery 작성자 확인: 대시보드/수정 권한 판정은 RLS로 행이 숨겨지면
    // 실제 존재하는 항목도 404처럼 보일 수 있어 service role로 존재 여부만 확인한다.
    const admin = createAdminClient();
    const { data: gallery } = await admin
      .from("gallery")
      .select("author")
      .eq("id", galleryId)
      .maybeSingle();

    if (!gallery) {
      return {
        authorized: false,
        error: NextResponse.json({ error: "Gallery not found" }, { status: 404 }),
      };
    }

    // 작성자인지 확인
    if (gallery.author !== user.id) {
      return {
        authorized: false,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return { authorized: true, error: null };
  } catch (error) {
    console.error("❌ 권한 검증 에러:", error);
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      ),
    };
  }
}
