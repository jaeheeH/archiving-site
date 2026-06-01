import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REFERENCE_ADMIN_ROLES = ["admin", "sub-admin", "sub_admin"];
const MAX_REFERENCE_RANGE = 3;
const MAX_REFERENCE_TEXT_LENGTH = 500;
const MAX_REFERENCE_TITLE_LENGTH = 160;
const MAX_REFERENCE_RANGE_LENGTH = 40;

export function normalizeReferenceText(value: unknown, max = MAX_REFERENCE_TEXT_LENGTH) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function normalizeReferenceTitle(value: unknown) {
  return normalizeReferenceText(value, MAX_REFERENCE_TITLE_LENGTH);
}

export function normalizeReferenceUrl(value: unknown) {
  const url = normalizeReferenceText(value, 2048);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeReferenceRange(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, MAX_REFERENCE_RANGE_LENGTH))
        .filter(Boolean)
    )
  ).slice(0, MAX_REFERENCE_RANGE);
}

export function getPrimaryReferenceCategory(range: unknown, fallback: unknown) {
  const normalizedRange = normalizeReferenceRange(range);
  if (normalizedRange[0]) return normalizedRange[0];

  return normalizeReferenceText(fallback, MAX_REFERENCE_RANGE_LENGTH);
}

/**
 * 레퍼런스 수정/삭제 권한 검증
 * 관리자(admin), 부관리자(sub-admin)만 가능
 */
export async function checkReferenceEditPermission() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
        userId: null,
      };
    }

    // users 테이블에서 role 확인
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        ),
        userId: null,
      };
    }

    const isAuthorized = REFERENCE_ADMIN_ROLES.includes(userData.role);

    if (!isAuthorized) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Only admin and sub-admin can access" },
          { status: 403 }
        ),
        userId: null,
      };
    }

    return {
      authorized: true,
      userId: user.id,
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("❌ 권한 체크 에러:", error);
    return {
      authorized: false,
      error: NextResponse.json(
        { error: message },
        { status: 500 }
      ),
      userId: null,
    };
  }
}

/**
 * 레퍼런스 소유권 또는 관리자 권한 검증
 * 작성자 또는 관리자(admin), 부관리자(sub-admin)만 가능
 */
export async function checkReferenceOwnershipOrAdmin(referenceId: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
        userId: null,
      };
    }

    // 레퍼런스 정보 조회
    const { data: referenceData, error: referenceError } = await supabase
      .from("references")
      .select("author")
      .eq("id", referenceId)
      .single();

    if (referenceError || !referenceData) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Reference not found" },
          { status: 404 }
        ),
        userId: null,
      };
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        ),
        userId: null,
      };
    }

    const isOwner = referenceData.author === user.id;
    const isAdmin = REFERENCE_ADMIN_ROLES.includes(userData.role);

    if (!isOwner && !isAdmin) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "You do not have permission to modify this reference" },
          { status: 403 }
        ),
        userId: null,
      };
    }

    return {
      authorized: true,
      userId: user.id,
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("❌ 소유권 검증 에러:", error);
    return {
      authorized: false,
      error: NextResponse.json(
        { error: message },
        { status: 500 }
      ),
      userId: null,
    };
  }
}
