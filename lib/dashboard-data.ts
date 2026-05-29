import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DashboardRole = "admin" | "sub-admin" | "editor" | "user";

type DashboardContext = {
  admin: ReturnType<typeof createAdminClient>;
  user: {
    id: string;
    email?: string;
  };
  profile: {
    id: string;
    email?: string | null;
    nickname?: string | null;
    role?: string | null;
  } | null;
  role: DashboardRole;
  adminUserIds: string[];
};

type CountValue = {
  value: number;
  error?: string;
};

function normalizeRole(role?: string | null): DashboardRole {
  if (role === "admin" || role === "sub-admin" || role === "editor") {
    return role;
  }

  return "user";
}

function applyAuthorScope(query: any, context: DashboardContext, column: "author" | "author_id") {
  if (context.role === "editor") {
    return query.eq(column, context.user.id);
  }

  if (context.role === "sub-admin" && context.adminUserIds.length > 0) {
    return query.not(column, "in", `(${context.adminUserIds.join(",")})`);
  }

  return query;
}

async function readCount(query: any): Promise<CountValue> {
  const { count, error } = await query;

  if (error) {
    return { value: 0, error: error.message };
  }

  return { value: count || 0 };
}

async function readRows<T>(query: any): Promise<T[]> {
  const { data, error } = await query;

  if (error) {
    console.error("Dashboard data query failed:", error.message);
    return [];
  }

  return data || [];
}

function totalCount(counts: CountValue[]) {
  return counts.reduce((sum, item) => sum + item.value, 0);
}

function toMonthKey(value?: string | null) {
  if (!value) return "날짜 없음";
  return value.slice(0, 7);
}

function sortEntries(entries: Record<string, number>, limit = 6) {
  return Object.entries(entries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export async function getDashboardContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, email, nickname, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = normalizeRole(profile?.role);
  let adminUserIds: string[] = [];

  if (role === "sub-admin") {
    const { data } = await admin.from("users").select("id").eq("role", "admin");
    adminUserIds = (data || []).map((item: { id: string }) => item.id);
  }

  return {
    admin,
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    role,
    adminUserIds,
  };
}

export async function getDashboardOverview() {
  const context = await getDashboardContext();
  if (!context) return null;

  const { admin } = context;

  const postBase = () =>
    applyAuthorScope(
      admin.from("posts").select("id", { count: "estimated", head: true }).eq("type", "blog"),
      context,
      "author_id"
    );

  const galleryBase = () =>
    applyAuthorScope(
      admin.from("gallery").select("id", { count: "estimated", head: true }),
      context,
      "author"
    );

  const referencesBase = () =>
    applyAuthorScope(
      admin.from("references").select("id", { count: "estimated", head: true }),
      context,
      "author"
    );

  const [
    postTotal,
    postPublished,
    postDraft,
    galleryTotal,
    referencesTotal,
    userTotal,
    brandTotal,
    generatedImageTotal,
    latestPosts,
    latestGallery,
    latestReferences,
    latestGeneratedImages,
    topPosts,
    topReferences,
  ] = await Promise.all([
    readCount(postBase()),
    readCount(postBase().eq("is_published", true)),
    readCount(postBase().eq("is_published", false)),
    readCount(galleryBase()),
    readCount(referencesBase()),
    context.role === "admin" || context.role === "sub-admin"
      ? readCount(admin.from("users").select("id", { count: "estimated", head: true }))
      : Promise.resolve({ value: 0 }),
    readCount(
      admin
        .from("brands")
        .select("id", { count: "estimated", head: true })
        .eq("user_id", context.user.id)
    ),
    readCount(
      admin
        .from("generated_images")
        .select("id", { count: "estimated", head: true })
        .eq("user_id", context.user.id)
    ),
    readRows<{
      id: string;
      title: string;
      slug: string | null;
      is_published: boolean;
      updated_at: string | null;
      published_at: string | null;
      view_count: number | null;
    }>(
      applyAuthorScope(
        admin
          .from("posts")
          .select("id, title, slug, is_published, updated_at, published_at, view_count, author_id")
          .eq("type", "blog")
          .order("updated_at", { ascending: false })
          .limit(5),
        context,
        "author_id"
      )
    ),
    readRows<{
      id: number;
      title: string;
      image_url: string | null;
      category: string | null;
      created_at: string | null;
    }>(
      applyAuthorScope(
        admin
          .from("gallery")
          .select("id, title, image_url, category, created_at, author")
          .order("created_at", { ascending: false })
          .limit(5),
        context,
        "author"
      )
    ),
    readRows<{
      id: number;
      title: string;
      url: string | null;
      range: string[] | null;
      clicks: number | null;
      created_at: string | null;
    }>(
      applyAuthorScope(
        admin
          .from("references")
          .select("id, title, url, range, clicks, created_at, author")
          .order("created_at", { ascending: false })
          .limit(5),
        context,
        "author"
      )
    ),
    readRows<{
      id: string;
      image_url: string;
      prompt: string | null;
      aspect_ratio: string | null;
      created_at: string | null;
    }>(
      admin
        .from("generated_images")
        .select("id, image_url, prompt, aspect_ratio, created_at")
        .eq("user_id", context.user.id)
        .order("created_at", { ascending: false })
        .limit(6)
    ),
    readRows<{
      id: string;
      title: string;
      slug: string | null;
      view_count: number | null;
      scrap_count: number | null;
      is_published: boolean;
    }>(
      applyAuthorScope(
        admin
          .from("posts")
          .select("id, title, slug, view_count, scrap_count, is_published, author_id")
          .eq("type", "blog")
          .order("view_count", { ascending: false })
          .limit(5),
        context,
        "author_id"
      )
    ),
    readRows<{
      id: number;
      title: string;
      url: string | null;
      clicks: number | null;
    }>(
      applyAuthorScope(
        admin
          .from("references")
          .select("id, title, url, clicks, author")
          .order("clicks", { ascending: false })
          .limit(5),
        context,
        "author"
      )
    ),
  ]);

  return {
    viewer: {
      id: context.user.id,
      email: context.user.email || context.profile?.email || "",
      nickname: context.profile?.nickname || context.user.email || "관리자",
      role: context.role,
    },
    stats: {
      postsTotal: postTotal.value,
      postsPublished: postPublished.value,
      postsDraft: postDraft.value,
      galleryTotal: galleryTotal.value,
      referencesTotal: referencesTotal.value,
      usersTotal: userTotal.value,
      brandsTotal: brandTotal.value,
      generatedImagesTotal: generatedImageTotal.value,
      contentTotal: totalCount([postTotal, galleryTotal, referencesTotal]),
    },
    latest: {
      posts: latestPosts,
      gallery: latestGallery,
      references: latestReferences,
      generatedImages: latestGeneratedImages,
    },
    top: {
      posts: topPosts,
      references: topReferences,
    },
  };
}

export async function getGalleryAnalytics() {
  const context = await getDashboardContext();
  if (!context) return null;

  const rows = await readRows<{
    id: number;
    category: string | null;
    range: string[] | null;
    tags: string[] | null;
    gemini_tags: string[] | null;
    created_at: string | null;
  }>(
    applyAuthorScope(
      context.admin
        .from("gallery")
        .select("id, category, range, tags, gemini_tags, created_at, author")
        .order("created_at", { ascending: false })
        .limit(1000),
      context,
      "author"
    )
  );

  const categories: Record<string, number> = {};
  const ranges: Record<string, number> = {};
  const tags: Record<string, number> = {};
  const months: Record<string, number> = {};

  rows.forEach((item) => {
    categories[item.category || "미분류"] = (categories[item.category || "미분류"] || 0) + 1;
    months[toMonthKey(item.created_at)] = (months[toMonthKey(item.created_at)] || 0) + 1;

    item.range?.forEach((range) => {
      ranges[range] = (ranges[range] || 0) + 1;
    });

    [...(item.tags || []), ...(item.gemini_tags || [])].forEach((tag) => {
      tags[tag] = (tags[tag] || 0) + 1;
    });
  });

  return {
    total: rows.length,
    categories: sortEntries(categories),
    ranges: sortEntries(ranges),
    tags: sortEntries(tags, 10),
    months: sortEntries(months, 8),
  };
}

export async function getReferencesAnalytics() {
  const context = await getDashboardContext();
  if (!context) return null;

  const rows = await readRows<{
    id: number;
    title: string;
    url: string | null;
    range: string[] | null;
    clicks: number | null;
    created_at: string | null;
  }>(
    applyAuthorScope(
      context.admin
        .from("references")
        .select("id, title, url, range, clicks, created_at, author")
        .order("created_at", { ascending: false })
        .limit(1000),
      context,
      "author"
    )
  );

  const ranges: Record<string, number> = {};
  const months: Record<string, number> = {};

  rows.forEach((item) => {
    months[toMonthKey(item.created_at)] = (months[toMonthKey(item.created_at)] || 0) + 1;

    if (!item.range?.length) {
      ranges["미분류"] = (ranges["미분류"] || 0) + 1;
      return;
    }

    item.range.forEach((range) => {
      ranges[range] = (ranges[range] || 0) + 1;
    });
  });

  return {
    total: rows.length,
    totalClicks: rows.reduce((sum, item) => sum + (item.clicks || 0), 0),
    ranges: sortEntries(ranges),
    months: sortEntries(months, 8),
    topClicked: [...rows]
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .slice(0, 10),
  };
}

export async function getGeneratedImageLibrary(limit = 80) {
  const context = await getDashboardContext();
  if (!context) return null;

  const safeLimit = Math.min(Math.max(limit, 1), 120);

  const images = await readRows<{
    id: string;
    image_url: string;
    prompt: string | null;
    aspect_ratio: string | null;
    seed: number | null;
    created_at: string | null;
    brands?: {
      name?: string | null;
    } | null;
  }>(
    context.admin
      .from("generated_images")
      .select("id, image_url, prompt, aspect_ratio, seed, created_at, brands(name)")
      .eq("user_id", context.user.id)
      .order("created_at", { ascending: false })
      .limit(safeLimit)
  );

  return {
    viewer: {
      id: context.user.id,
      email: context.user.email || context.profile?.email || "",
      nickname: context.profile?.nickname || context.user.email || "관리자",
      role: context.role,
    },
    images,
  };
}
