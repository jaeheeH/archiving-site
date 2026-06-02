import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { normalizeAvatarUrl } from "@/lib/avatar-url";

export const CACHE_TAGS = {
  siteSettings: "site-settings",
  home: "public-home",
  gallery: "public-gallery",
  posts: "public-posts",
  references: "public-references",
} as const;

export const CACHE_SECONDS = {
  short: 600,
  medium: 3600,
  long: 86400,
} as const;

export const PUBLIC_API_CACHE_CONTROL = `public, s-maxage=${CACHE_SECONDS.short}, stale-while-revalidate=${CACHE_SECONDS.medium}`;

const GALLERY_LIST_COLUMNS = `
  id,
  title,
  description,
  image_url,
  thumbnail_url,
  image_width,
  image_height,
  created_at,
  tags,
  category,
  range,
  gemini_tags,
  gemini_description
`;

const GALLERY_LIST_COLUMNS_WITHOUT_THUMBNAIL = `
  id,
  title,
  description,
  image_url,
  image_width,
  image_height,
  created_at,
  tags,
  category,
  range,
  gemini_tags,
  gemini_description
`;

const GALLERY_DETAIL_COLUMNS = `
  id,
  title,
  description,
  image_url,
  thumbnail_url,
  image_width,
  image_height,
  tags,
  gemini_tags,
  gemini_description,
  category,
  range,
  created_at
`;

const GALLERY_DETAIL_COLUMNS_WITHOUT_THUMBNAIL = `
  id,
  title,
  description,
  image_url,
  image_width,
  image_height,
  tags,
  gemini_tags,
  gemini_description,
  category,
  range,
  created_at
`;

const DAILY_GALLERY_COLUMNS = "id, title, description, image_url, thumbnail_url";
const DAILY_GALLERY_COLUMNS_WITHOUT_THUMBNAIL = "id, title, description, image_url";
const HOME_GALLERY_COLUMNS = "id, title, description, image_url, thumbnail_url, tags, gemini_tags";
const HOME_GALLERY_COLUMNS_WITHOUT_THUMBNAIL = "id, title, description, image_url, tags, gemini_tags";
const SIMILAR_GALLERY_COLUMNS =
  "id, title, image_url, thumbnail_url, image_width, image_height, description, embedding";
const SIMILAR_GALLERY_COLUMNS_WITHOUT_THUMBNAIL =
  "id, title, image_url, image_width, image_height, description, embedding";

const POST_LIST_COLUMNS =
  "id, title, subtitle, summary, slug, is_published, published_at, created_at, updated_at, title_image_url, category_id, view_count, scrap_count, author_id";

const POST_DETAIL_COLUMNS =
  "id, type, title, subtitle, summary, slug, content, tags, is_published, published_at, created_at, updated_at, title_style, title_image_url, thumbnail_url, category_id, view_count, scrap_count, author_id";

const REFERENCE_COLUMNS =
  "id, title, description, url, image_url, logo_url, category, range, clicks, created_at, updated_at";

const MAX_SEARCH_LENGTH = 80;
const MAX_FILTER_TAGS = 10;
const MAX_FILTER_TAG_LENGTH = 40;
const MAX_TAG_AGGREGATION_ROWS = 1000;
const MAX_SIMILAR_CANDIDATE_ROWS = 1000;

type QueryError = { code?: string; message?: string } | null;
type ListQueryResult<T> = {
  data: T[] | null;
  error: QueryError;
  count?: number | null;
};
type SingleQueryResult<T> = {
  data: T | null;
  error: QueryError;
};

type HomeGalleryRow = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  thumbnail_url: string | null;
  tags: string[];
  gemini_tags: string[];
};

type GalleryListRow = HomeGalleryRow & {
  image_width: number;
  image_height: number;
  created_at: string;
  category?: string;
  range: string[];
  gemini_description?: string;
};

type GalleryDetailRow = GalleryListRow & {
  created_at: string;
};

type DailyGalleryRow = {
  id: number;
  title: string;
  description: string | null;
  image_url: string;
  thumbnail_url: string | null;
};

type SimilarGalleryRow = {
  id: number;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  image_width: number | null;
  image_height: number | null;
  description: string | null;
  embedding: unknown;
};

function normalizePositiveInt(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

function normalizeFilterText(value = "", max = MAX_SEARCH_LENGTH) {
  return value
    .trim()
    .slice(0, max)
    .replace(/[{}()[\]",%:*&|!']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTags(tagsCsv = "") {
  return tagsCsv
    .split(",")
    .map((tag) => normalizeFilterText(tag, MAX_FILTER_TAG_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_FILTER_TAGS);
}

function buildTextSearchQuery(search: string) {
  return normalizeFilterText(search)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word}:*`)
    .join(" & ");
}

function isMissingThumbnailColumn(error: unknown) {
  const queryError = error as { code?: string; message?: string } | null;

  return (
    queryError?.code === "42703" &&
    /thumbnail_url/i.test(queryError.message || "")
  );
}

function withNullThumbnail<T extends object>(items: T[] | null | undefined) {
  return (items || []).map((item) => ({
    ...item,
    thumbnail_url: null,
  }));
}

async function readHomeGallery(supabase: ReturnType<typeof createPublicClient>) {
  const query = (columns: string) =>
    supabase
      .from("gallery")
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(10);

  const result = (await query(HOME_GALLERY_COLUMNS)) as unknown as ListQueryResult<HomeGalleryRow>;

  if (!isMissingThumbnailColumn(result.error)) {
    return result;
  }

  const fallback = (await query(
    HOME_GALLERY_COLUMNS_WITHOUT_THUMBNAIL
  )) as unknown as ListQueryResult<Omit<HomeGalleryRow, "thumbnail_url">>;

  return {
    ...fallback,
    data: withNullThumbnail(fallback.data),
  };
}

export const getHomeData = unstable_cache(
  async () => {
    const supabase = createPublicClient();

    const [blogRes, popularRes, referencesRes, galleryRes, categoriesRes] =
      await Promise.all([
        supabase
          .from("posts")
          .select(
            "id, title, subtitle, summary, slug, published_at, created_at, title_image_url, category_id, view_count, scrap_count"
          )
          .eq("type", "blog")
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .limit(4),
        supabase
          .from("posts")
          .select("id, title, slug, published_at, category_id")
          .eq("type", "blog")
          .eq("is_published", true)
          .order("view_count", { ascending: false })
          .limit(5),
        supabase
          .from("references")
          .select("id, title, description, url, image_url, logo_url, category, range, clicks")
          .order("created_at", { ascending: false })
          .limit(8),
        readHomeGallery(supabase),
        supabase.from("categories").select("id, name").eq("type", "blog"),
      ]);

    const categoryMap: Record<string, string> = {};
    categoriesRes.data?.forEach((category: { id: string; name: string }) => {
      categoryMap[category.id] = category.name;
    });

    return {
      latestBlogs: blogRes.data || [],
      popularBlogs: popularRes.data || [],
      references: referencesRes.data || [],
      gallery: galleryRes.data || [],
      categories: categoryMap,
    };
  },
  ["home-data"],
  {
    revalidate: CACHE_SECONDS.medium,
    tags: [CACHE_TAGS.home, CACHE_TAGS.posts, CACHE_TAGS.gallery, CACHE_TAGS.references],
  }
);

export const getGalleryPageData = unstable_cache(
  async (pageValue: number, limitValue: number, search = "", tagsCsv = "") => {
    const supabase = createPublicClient();
    const page = normalizePositiveInt(pageValue, 1, 10_000);
    const limit = normalizePositiveInt(limitValue, 36, 100);
    const offset = (page - 1) * limit;
    const safeSearch = normalizeFilterText(search);
    const filterTags = parseTags(tagsCsv);

    const buildQuery = (columns: string) => {
      let query = supabase
        .from("gallery")
        .select(columns, { count: "planned" })
        .order("created_at", { ascending: false });

      if (safeSearch) {
        query = query.textSearch("search_vector", buildTextSearchQuery(safeSearch));
      }

      for (const tag of filterTags) {
        query = query.or(`tags.cs.{${tag}},gemini_tags.cs.{${tag}}`);
      }

      return query.range(offset, offset + limit - 1);
    };

    let { data, error, count } = (await buildQuery(
      GALLERY_LIST_COLUMNS
    )) as unknown as ListQueryResult<GalleryListRow>;

    if (isMissingThumbnailColumn(error)) {
      const fallback = (await buildQuery(
        GALLERY_LIST_COLUMNS_WITHOUT_THUMBNAIL
      )) as unknown as ListQueryResult<Omit<GalleryListRow, "thumbnail_url">>;
      data = withNullThumbnail(fallback.data);
      error = fallback.error;
      count = fallback.count;
    }

    if (error) throw error;

    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
      filters: {
        search: safeSearch,
        tags: filterTags,
      },
    };
  },
  ["gallery-page-data"],
  {
    revalidate: CACHE_SECONDS.short,
    tags: [CACHE_TAGS.gallery],
  }
);

export const getGalleryDetailData = unstable_cache(
  async (idValue: number) => {
    const supabase = createPublicClient();
    const id = Number(idValue);

    let { data: gallery, error } = (await supabase
      .from("gallery")
      .select(GALLERY_DETAIL_COLUMNS)
      .eq("id", id)
      .single()) as unknown as SingleQueryResult<GalleryDetailRow>;

    if (isMissingThumbnailColumn(error)) {
      const fallback = (await supabase
        .from("gallery")
        .select(GALLERY_DETAIL_COLUMNS_WITHOUT_THUMBNAIL)
        .eq("id", id)
        .single()) as unknown as SingleQueryResult<Omit<GalleryDetailRow, "thumbnail_url">>;

      gallery = fallback.data ? { ...fallback.data, thumbnail_url: null } : null;
      error = fallback.error;
    }

    if (error || !gallery) {
      return null;
    }

    const [prevResult, nextResult] = await Promise.all([
      supabase
        .from("gallery")
        .select("id")
        .gt("id", id)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("gallery")
        .select("id")
        .lt("id", id)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      gallery,
      prevId: prevResult.data?.id ?? null,
      nextId: nextResult.data?.id ?? null,
    };
  },
  ["gallery-detail-data"],
  {
    revalidate: CACHE_SECONDS.medium,
    tags: [CACHE_TAGS.gallery],
  }
);

export const getGalleryTopTags = unstable_cache(
  async (selectedTagsCsv = "", searchQuery = "") => {
    const supabase = createPublicClient();
    const selectedTags = parseTags(selectedTagsCsv);
    const selectedTagsSet = new Set(selectedTags);
    const safeSearchQuery = normalizeFilterText(searchQuery);

    let query = supabase.from("gallery").select("tags, gemini_tags");

    for (const tag of selectedTags) {
      query = query.or(`tags.cs.{${tag}},gemini_tags.cs.{${tag}}`);
    }

    if (safeSearchQuery) {
      query = query.or(
        `gemini_description.ilike.%${safeSearchQuery}%,gemini_tags.cs.{${safeSearchQuery}},tags.cs.{${safeSearchQuery}}`
      );
    }

    const { data: galleryItems, error } = await query.limit(MAX_TAG_AGGREGATION_ROWS);
    if (error) throw error;
    if (!galleryItems?.length) return [];

    const tagCount: Record<string, number> = {};
    const currentTotalCount = galleryItems.length;

    galleryItems.forEach(
      (item: { tags?: string[] | null; gemini_tags?: string[] | null }) => {
        const uniqueItemTags = new Set<string>();

        item.tags?.forEach((tag) => tag && uniqueItemTags.add(tag));
        item.gemini_tags?.forEach((tag) => tag && uniqueItemTags.add(tag));

        uniqueItemTags.forEach((tag) => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    );

    return Object.entries(tagCount)
      .filter(([tag, count]) => selectedTagsSet.has(tag) || count !== currentTotalCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  },
  ["gallery-top-tags"],
  {
    revalidate: CACHE_SECONDS.short,
    tags: [CACHE_TAGS.gallery],
  }
);

export const getDailyGalleryImages = unstable_cache(
  async (limitValue: number) => {
    const supabase = createPublicClient();
    const limit = normalizePositiveInt(limitValue, 36, 100);

    const query = (columns: string) =>
      supabase
        .from("gallery")
        .select(columns)
        .order("created_at", { ascending: false })
        .limit(limit);

    let { data, error } = (await query(
      DAILY_GALLERY_COLUMNS
    )) as unknown as ListQueryResult<DailyGalleryRow>;

    if (isMissingThumbnailColumn(error)) {
      const fallback = (await query(
        DAILY_GALLERY_COLUMNS_WITHOUT_THUMBNAIL
      )) as unknown as ListQueryResult<Omit<DailyGalleryRow, "thumbnail_url">>;
      data = withNullThumbnail(fallback.data);
      error = fallback.error;
    }

    if (error) throw error;
    return data || [];
  },
  ["daily-gallery-images"],
  {
    revalidate: CACHE_SECONDS.long,
    tags: [CACHE_TAGS.gallery],
  }
);

function calculateCosineSimilarity(vector1: number[], vector2: number[]) {
  if (vector1.length !== vector2.length) return 0;

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  return magnitude1 === 0 || magnitude2 === 0 ? 0 : dotProduct / (magnitude1 * magnitude2);
}

function parseEmbedding(embedding: unknown) {
  if (typeof embedding === "string") return JSON.parse(embedding) as number[];
  if (Array.isArray(embedding)) return embedding as number[];
  return null;
}

export const getSimilarGallery = unstable_cache(
  async (galleryIdValue: number, limitValue: number) => {
    const supabase = createPublicClient();
    const galleryId = Number(galleryIdValue);
    const limit = normalizePositiveInt(limitValue, 8, 24);
    const similarityThreshold = 0.75;

    const { data: currentGallery, error: currentError } = await supabase
      .from("gallery")
      .select("embedding")
      .eq("id", galleryId)
      .single();

    if (currentError || !currentGallery?.embedding) {
      return {
        data: [],
        metadata: {
          totalSimilar: 0,
          threshold: similarityThreshold,
        },
      };
    }

    const currentEmbedding = parseEmbedding(currentGallery.embedding);
    if (!currentEmbedding) {
      return {
        data: [],
        metadata: {
          totalSimilar: 0,
          threshold: similarityThreshold,
        },
      };
    }

    const similarQuery = (columns: string) =>
      supabase
        .from("gallery")
        .select(columns)
        .neq("id", galleryId)
        .not("embedding", "is", null)
        .order("created_at", { ascending: false })
        .limit(MAX_SIMILAR_CANDIDATE_ROWS);

    let { data: allGalleries, error: allError } = (await similarQuery(
      SIMILAR_GALLERY_COLUMNS
    )) as unknown as ListQueryResult<SimilarGalleryRow>;

    if (isMissingThumbnailColumn(allError)) {
      const fallback = (await similarQuery(
        SIMILAR_GALLERY_COLUMNS_WITHOUT_THUMBNAIL
      )) as unknown as ListQueryResult<Omit<SimilarGalleryRow, "thumbnail_url">>;
      allGalleries = withNullThumbnail(fallback.data);
      allError = fallback.error;
    }

    if (allError) throw allError;

    const similarities = (allGalleries || [])
      .map((gallery) => {
        try {
          const embedding = parseEmbedding(gallery.embedding);
          if (!embedding) return null;

          const similarity = calculateCosineSimilarity(currentEmbedding, embedding);
          if (similarity < similarityThreshold) return null;

          return {
            id: gallery.id,
            title: gallery.title,
            image_url: gallery.image_url,
            thumbnail_url: gallery.thumbnail_url,
            image_width: gallery.image_width,
            image_height: gallery.image_height,
            description: gallery.description,
            similarity,
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return {
      data: similarities,
      metadata: {
        totalSimilar: similarities.length,
        threshold: similarityThreshold,
      },
    };
  },
  ["similar-gallery"],
  {
    revalidate: CACHE_SECONDS.medium,
    tags: [CACHE_TAGS.gallery],
  }
);

export const getPostsPageData = unstable_cache(
  async (type = "blog", limitValue: number, offsetValue: number, categoryId = "all") => {
    const supabase = createPublicClient();
    const limit = normalizePositiveInt(limitValue, 12, 100);
    const offset = Math.max(0, Math.floor(offsetValue || 0));

    let query = supabase
      .from("posts")
      .select(POST_LIST_COLUMNS, { count: "planned" })
      .eq("type", type)
      .eq("is_published", true)
      .not("published_at", "is", null);

    if (categoryId && categoryId !== "all") {
      query = query.eq("category_id", categoryId);
    }

    const { data, error, count } = await query
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
    };
  },
  ["posts-page-data"],
  {
    revalidate: CACHE_SECONDS.short,
    tags: [CACHE_TAGS.posts],
  }
);

export const getBlogCategories = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .eq("type", "blog")
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },
  ["blog-categories"],
  {
    revalidate: CACHE_SECONDS.medium,
    tags: [CACHE_TAGS.posts],
  }
);

export const getBlogPostData = unstable_cache(
  async (slug: string) => {
    const supabase = createPublicClient();

    const { data: post } = await supabase
      .from("posts")
      .select(POST_DETAIL_COLUMNS)
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (post) {
      const [categoryRes, authorRes] = await Promise.all([
        post.category_id
          ? supabase
              .from("categories")
              .select("id, name")
              .eq("id", post.category_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        post.author_id
          ? supabase
              .from("users")
              .select("id, nickname, name, avatar_url")
              .eq("id", post.author_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (categoryRes.error) {
        console.error("Failed to load blog category:", categoryRes.error.message);
      }

      if (authorRes.error) {
        console.error("Failed to load blog author:", authorRes.error.message);
      }

      const relatedByCategory = post.category_id
        ? await supabase
            .from("posts")
            .select("id, title, subtitle, summary, slug, published_at, created_at, title_image_url, category_id")
            .eq("type", "blog")
            .eq("is_published", true)
            .not("published_at", "is", null)
            .eq("category_id", post.category_id)
            .neq("id", post.id)
            .order("published_at", { ascending: false })
            .limit(3)
        : { data: [], error: null };

      if (relatedByCategory.error) {
        console.error("Failed to load related blog posts:", relatedByCategory.error.message);
      }

      let relatedPosts = relatedByCategory.data || [];

      if (relatedPosts.length < 3) {
        const relatedIds = new Set(relatedPosts.map((item) => item.id));
        const fallbackRes = await supabase
          .from("posts")
          .select("id, title, subtitle, summary, slug, published_at, created_at, title_image_url, category_id")
          .eq("type", "blog")
          .eq("is_published", true)
          .not("published_at", "is", null)
          .neq("id", post.id)
          .order("published_at", { ascending: false })
          .limit(6);

        if (fallbackRes.error) {
          console.error("Failed to load fallback related posts:", fallbackRes.error.message);
        }

        const fallbackPosts = (fallbackRes.data || []).filter(
          (item) => !relatedIds.has(item.id)
        );

        relatedPosts = [
          ...relatedPosts,
          ...fallbackPosts.slice(0, 3 - relatedPosts.length),
        ];
      }

      return {
        post,
        redirectSlug: null,
        category: categoryRes.data || null,
        authorProfile: authorRes.data
          ? {
              ...authorRes.data,
              avatar_url: normalizeAvatarUrl(authorRes.data.avatar_url),
            }
          : null,
        relatedPosts,
      };
    }

    const { data: history } = await supabase
      .from("post_slug_history")
      .select("new_slug")
      .eq("old_slug", slug)
      .single();

    if (history?.new_slug) {
      return { post: null, redirectSlug: history.new_slug };
    }

    return null;
  },
  ["blog-post-data"],
  {
    revalidate: CACHE_SECONDS.long,
    tags: [CACHE_TAGS.posts],
  }
);

export const getReferencesPageData = unstable_cache(
  async () => {
    const supabase = createPublicClient();

    const [categoriesRes, referencesRes] = await Promise.all([
      supabase
        .from("reference_categories")
        .select("id, name")
        .order("created_at", { ascending: true }),
      supabase
        .from("references")
        .select("id, title, description, url, image_url, logo_url, category, range, clicks, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (referencesRes.error) throw referencesRes.error;

    const categories = new Set<string>();

    (categoriesRes.data || []).forEach((category: { name: string | null }) => {
      const name = category.name?.trim();
      if (name) categories.add(name);
    });

    (referencesRes.data || []).forEach((reference: { category?: string | null; range?: string[] | null }) => {
      const category = reference.category?.trim();
      if (category) categories.add(category);

      reference.range?.forEach((range) => {
        const name = range.trim();
        if (name) categories.add(name);
      });
    });

    return {
      categories: Array.from(categories),
      references: referencesRes.data || [],
    };
  },
  ["references-page-data-v3"],
  {
    revalidate: CACHE_SECONDS.long,
    tags: [CACHE_TAGS.references],
  }
);

export const getReferencesListData = unstable_cache(
  async (
    pageValue: number,
    limitValue: number,
    category = "",
    sort = "created_at",
    orderValue: "asc" | "desc" = "desc",
    search = ""
  ) => {
    const supabase = createPublicClient();
    const page = normalizePositiveInt(pageValue, 1, 10_000);
    const limit = normalizePositiveInt(limitValue, 10, 100);
    const offset = (page - 1) * limit;
    const safeCategory = normalizeFilterText(category, MAX_FILTER_TAG_LENGTH);
    const safeSearch = normalizeFilterText(search);

    let query = supabase
      .from("references")
      .select(REFERENCE_COLUMNS, { count: "planned" });

    if (safeCategory) {
      query = query.or(`category.eq.${safeCategory},range.cs.{"${safeCategory}"}`);
    }

    if (safeSearch) {
      query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
    }

    const validSortFields = ["created_at", "clicks", "title"];
    const sortField = validSortFields.includes(sort) ? sort : "created_at";
    const order = orderValue === "asc" ? "asc" : "desc";

    const { data, count, error } = await query
      .order(sortField, { ascending: order === "asc" })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
    };
  },
  ["references-list-data"],
  {
    revalidate: CACHE_SECONDS.short,
    tags: [CACHE_TAGS.references],
  }
);
