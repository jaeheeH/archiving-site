import { NextResponse } from "next/server";
import { createAdminClient } from "./admin";
import { createClient } from "./server";
import { getErrorMessage } from "@/lib/error-message";
import { isUuidParam } from "@/lib/route-params";

const POST_EDITOR_ROLES = ["admin", "sub-admin", "editor"];

type UserRoleRow = {
  role?: string | null;
};

type PostOwnerRow = {
  id: string;
  author_id?: string | null;
};

type AuthorizedPostEditPermission = {
  authorized: true;
  userId: string;
  role: string;
  error: null;
};

type UnauthorizedPostEditPermission = {
  authorized: false;
  userId: string | null;
  role: string | null;
  error: NextResponse;
};

type PostEditPermission =
  | AuthorizedPostEditPermission
  | UnauthorizedPostEditPermission;

type AuthorizedPostOwnershipPermission = AuthorizedPostEditPermission & {
  post: PostOwnerRow;
};

type UnauthorizedPostOwnershipPermission = UnauthorizedPostEditPermission & {
  post: PostOwnerRow | null;
};

type PostOwnershipPermission =
  | AuthorizedPostOwnershipPermission
  | UnauthorizedPostOwnershipPermission;

export async function checkPostEditPermission(): Promise<PostEditPermission> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        userId: null,
        role: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    const userRow = data as UserRoleRow | null;

    if (error || !userRow?.role || !POST_EDITOR_ROLES.includes(userRow.role)) {
      return {
        authorized: false,
        userId: user.id,
        role: userRow?.role || null,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return {
      authorized: true,
      userId: user.id,
      role: userRow.role,
      error: null,
    };
  } catch (error: unknown) {
    return {
      authorized: false,
      userId: null,
      role: null,
      error: NextResponse.json(
        { error: getErrorMessage(error, "Internal server error") },
        { status: 500 }
      ),
    };
  }
}

export async function checkPostOwnershipOrAdmin(
  postId: string
): Promise<PostOwnershipPermission> {
  const permCheck = await checkPostEditPermission();
  if (!permCheck.authorized) return { ...permCheck, post: null };

  if (!isUuidParam(postId)) {
    return {
      authorized: false,
      userId: permCheck.userId,
      role: permCheck.role,
      post: null,
      error: NextResponse.json({ error: "Invalid post id" }, { status: 400 }),
    };
  }

  const admin = createAdminClient();
  const { data: postData, error: postError } = await admin
    .from("posts")
    .select("id, author_id")
    .eq("id", postId)
    .single();
  const post = postData as PostOwnerRow | null;

  if (postError || !post) {
    return {
      authorized: false,
      userId: permCheck.userId,
      role: permCheck.role,
      post: null,
      error: NextResponse.json({ error: "Post not found" }, { status: 404 }),
    };
  }

  if (permCheck.role === "admin") {
    return { ...permCheck, post };
  }

  if (permCheck.role === "editor") {
    if (post.author_id === permCheck.userId) return { ...permCheck, post };

    return {
      authorized: false,
      userId: permCheck.userId,
      role: permCheck.role,
      post,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (permCheck.role === "sub-admin" && post.author_id !== permCheck.userId) {
    const { data: authorData } = post.author_id
      ? await admin.from("users").select("role").eq("id", post.author_id).single()
      : { data: null };
    const author = authorData as UserRoleRow | null;

    if (author?.role === "admin") {
      return {
        authorized: false,
        userId: permCheck.userId,
        role: permCheck.role,
        post,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return { ...permCheck, post };
}
