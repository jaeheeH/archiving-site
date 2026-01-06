"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import DashboardTitle from "@/app/(dashboard)/components/DashboardHeader";
import Link from "next/link";

type Post = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  slug: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  title_image_url: string | null;
  category_id: string | null;
  view_count?: number;
  scrap_count?: number;
  author_id: string;
};

type Category = {
  id: string;
  name: string;
};

type User = {
  id: string;
  role: string;
};

type SortField = "created_at" | "published_at" | "view_count" | "scrap_count";
type SortOrder = "asc" | "desc";

function BlogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { addToast } = useToast();

  const pageFromUrl = Number(searchParams.get("page") || 1);
  const categoryFromUrl = searchParams.get("category") || "all";
  const sortByFromUrl = (searchParams.get("sortBy") || "created_at") as SortField;
  const sortOrderFromUrl = (searchParams.get("sortOrder") || "desc") as SortOrder;
  const showDraftFromUrl = searchParams.get("draft") === "true";

  // 데이터 상태
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authors, setAuthors] = useState<Record<string, User>>({});

  // 페이지네이션
  const [page, setPage] = useState(pageFromUrl);
  const limit = 20;
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 필터 & 정렬
  const [categoryFilter, setCategoryFilter] = useState<string>(categoryFromUrl);
  const [showDraftOnly, setShowDraftOnly] = useState(showDraftFromUrl);
  const [sortBy, setSortBy] = useState<SortField>(sortByFromUrl);
  const [sortOrder, setSortOrder] = useState<SortOrder>(sortOrderFromUrl);

  // 체크박스 선택
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 카테고리 추가
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // URL 업데이트
  const updateUrl = (newPage?: number, newCategory?: string, newShowDraft?: boolean, newSortBy?: SortField, newSortOrder?: SortOrder) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newPage !== undefined) params.set("page", String(newPage));
    if (newCategory !== undefined) params.set("category", newCategory);
    if (newShowDraft !== undefined) params.set("draft", String(newShowDraft));
    if (newSortBy !== undefined) params.set("sortBy", newSortBy);
    if (newSortOrder !== undefined) params.set("sortOrder", newSortOrder);

    router.push(`${pathname}?${params.toString()}`);
  };

  // 현재 사용자 로드
  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("id, role")
          .eq("id", user.id)
          .single();

        if (profile) {
          setCurrentUser(profile);
        }
      }
    } catch (error) {
      console.error("사용자 로드 실패:", error);
    }
  };

  // 카테고리 로드
  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/posts/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("카테고리 로드 실패:", error);
    }
  };

  // 포스트 조회
  const fetchPosts = async (pageNum = 1) => {
    try {
      setLoading(true);

      const offset = (pageNum - 1) * limit;
      const res = await fetch(
        `/api/admin/posts?type=blog&limit=${limit}&offset=${offset}`
      );
      const data = await res.json();

      if (!res.ok) {
        console.error("포스트 조회 실패:", data.error);
        setPosts([]);
        return;
      }

      let postsData = data.data || [];

      // 필터 적용
      postsData = postsData.filter((post: Post) => {
        // 초안보기 필터
        if (showDraftOnly && post.is_published) return false;

        // 카테고리 필터
        if (categoryFilter !== "all") {
          if (categoryFilter === "uncategorized") {
            if (post.category_id !== null) return false;
          } else {
            if (post.category_id !== categoryFilter) return false;
          }
        }

        return true;
      });

      // 정렬 적용
      postsData = postsData.sort((a: Post, b: Post) => {
        let aValue: any = a[sortBy];
        let bValue: any = b[sortBy];

        // null 처리
        if (aValue === null || aValue === undefined) aValue = 0;
        if (bValue === null || bValue === undefined) bValue = 0;

        // 날짜 문자열 비교
        if (typeof aValue === "string" && sortBy.includes("_at")) {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }

        // 숫자 비교
        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
        }

        return 0;
      });

      setPosts(postsData);
      
      // 전체 카운트 계산 (필터 적용 후)
      setTotalCount(postsData.length);
      setTotalPages(Math.ceil(postsData.length / limit));

      // 작성자 정보 가져오기
      const authorIds = [...new Set(postsData.map((p: Post) => p.author_id))];
      if (authorIds.length > 0) {
        const { data: authorsData } = await supabase
          .from("users")
          .select("id, role")
          .in("id", authorIds);

        if (authorsData) {
          const authorsMap: Record<string, User> = {};
          authorsData.forEach((author) => {
            authorsMap[author.id] = author;
          });
          setAuthors(authorsMap);
        }
      }

      setSelectedIds([]);
    } catch (error) {
      console.error("포스트 조회 에러:", error);
      addToast("포스트 조회 실패", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchPosts(page);
  }, [page, categoryFilter, showDraftOnly, sortBy, sortOrder]);

  // 정렬 헤더 클릭
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      // 같은 컬럼 클릭 → 오름/내림 토글
      const newOrder = sortOrder === "desc" ? "asc" : "desc";
      setSortOrder(newOrder);
      updateUrl(1, undefined, undefined, field, newOrder);
    } else {
      // 다른 컬럼 클릭 → 내림차순으로 초기화
      setSortBy(field);
      setSortOrder("desc");
      updateUrl(1, undefined, undefined, field, "desc");
    }
  };

  // 페이지 업데이트
  const updatePage = (pageNum: number) => {
    setPage(pageNum);
    updateUrl(pageNum);
  };

  // 카테고리 필터 변경
  const handleCategoryChange = (catId: string) => {
    setCategoryFilter(catId);
    setPage(1);
    updateUrl(1, catId);
  };

  // 카테고리 추가
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      addToast("카테고리 이름을 입력해주세요", "error");
      return;
    }

    try {
      const res = await fetch("/api/posts/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });

      if (res.ok) {
        addToast("카테고리가 추가되었습니다!", "success");
        setNewCategoryName("");
        setShowAddCategory(false);
        fetchCategories();
      } else {
        addToast("카테고리 추가 실패", "error");
      }
    } catch (error) {
      console.error("카테고리 추가 에러:", error);
      addToast("카테고리 추가 중 오류가 발생했습니다", "error");
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`"${categoryName}" 카테고리를 삭제하시겠습니까?\n이 카테고리를 사용하는 포스트가 있으면 삭제할 수 없습니다.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/posts/categories?id=${categoryId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        addToast("카테고리가 삭제되었습니다", "success");
        if (categoryFilter === categoryId) {
          handleCategoryChange("all");
        }
        fetchCategories();
      } else {
        addToast(data.error || "카테고리 삭제 실패", "error");
      }
    } catch (error) {
      console.error("카테고리 삭제 에러:", error);
      addToast("카테고리 삭제 중 오류가 발생했습니다", "error");
    }
  };

  // 초안보기 토글
  const handleDraftToggle = (show: boolean) => {
    setShowDraftOnly(show);
    setPage(1);
    updateUrl(1, undefined, show);
  };

  // 개별 아이템 선택
  const handleSelectItem = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  // 모두 선택/해제
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(posts.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 개별 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("삭제 실패");
      }

      addToast("삭제되었습니다!", "success");
      fetchPosts(page);
    } catch (error: any) {
      console.error("삭제 에러:", error);
      addToast("삭제 실패", "error");
    }
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      addToast("선택된 항목이 없습니다.", "error");
      return;
    }

    if (!confirm(`${selectedIds.length}개의 포스트를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const deletePromises = selectedIds.map(id =>
        fetch(`/api/posts/${id}`, { method: "DELETE" })
      );

      const results = await Promise.all(deletePromises);
      const allSuccess = results.every(res => res.ok);

      if (allSuccess) {
        addToast(`${selectedIds.length}개 삭제되었습니다!`, "success");
        setSelectedIds([]);
        fetchPosts(page);
      } else {
        addToast("일부 포스트 삭제에 실패했습니다", "error");
      }
    } catch (error: any) {
      console.error("일괄 삭제 에러:", error);
      addToast("삭제 중 오류가 발생했습니다", "error");
    }
  };

  // 권한 확인
  const canEditPost = (post: Post): boolean => {
    if (!currentUser) return false;

    if (currentUser.role === "admin") return true;

    if (currentUser.role === "sub-admin") {
      const authorRole = authors[post.author_id]?.role;
      return authorRole !== "admin";
    }

    if (currentUser.role === "editor") {
      return currentUser.id === post.author_id;
    }

    return false;
  };

  const canDeletePost = (post: Post): boolean => {
    return canEditPost(post);
  };

  const canPublishPost = (post: Post): boolean => {
    return canEditPost(post);
  };

  // 발행 상태 토글
  const handleTogglePublish = async (post: Post) => {
    try {
      const res = await fetch(`/api/posts/${post.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_published: !post.is_published,
        }),
      });

      if (res.ok) {
        fetchPosts(page);
      } else {
        addToast("발행 상태 변경 실패", "error");
      }
    } catch (error) {
      console.error("발행 상태 변경 실패:", error);
      addToast("발행 상태 변경 중 오류가 발생했습니다", "error");
    }
  };

  // 페이지 카테고리명 가져오기
  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return "미분류";
    const category = categories.find((cat) => cat.id === categoryId);
    return category?.name || "미분류";
  };

  // 페이지네이션 계산
  const paginatedPosts = posts.slice((page - 1) * limit, page * limit);

  if (loading && posts.length === 0) {
    return <div className="p-6">불러오는 중...</div>;
  }

  return (
    <div>
      {/* 헤더 */}
      <header className="dashboard-Header">
        <DashboardTitle title="블로그 관리" />
        <div className="flex gap-2 items-center">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              <i className="ri-delete-bin-line mr-1"></i>
              {selectedIds.length}개 삭제
            </button>
          )}
          <Link
            href="/dashboard/contents/blog/create"
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 inline-flex items-center"
          >
            <i className="ri-add-line mr-1"></i>
            새 글 작성
          </Link>
        </div>
      </header>

      <div className="dashboard-container">
        {/* 필터 & 정렬 */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          {/* 카테고리 탭 필터 */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => handleCategoryChange("all")}
              className={`px-3 py-2 text-sm rounded whitespace-nowrap transition ${
                categoryFilter === "all"
                  ? "bg-black text-white"
                  : "border text-gray-600 hover:bg-gray-100"
              }`}
            >
              전체
            </button>
            {categories.map((category) => (
              <div key={category.id} 
                onClick={() => handleCategoryChange(category.id)}
                className={`relative flex group gap-2 px-3 py-2 text-sm rounded whitespace-nowrap transition ${
                  categoryFilter === category.id
                    ? "bg-black text-white"
                    : "border text-gray-600 hover:bg-gray-100"
                }`}
              >
                <p>{category.name}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(category.id, category.name);
                  }}
                  className={` rounded opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 ${
                    categoryFilter === category.id
                      ? "text-white hover:bg-black"
                      : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                  }`}
                  title="카테고리 삭제"
                >
                  <i className="ri-close-line text-sm"></i>
                </button>
              </div>
            ))}

            {/* 카테고리 추가 */}
            {showAddCategory ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  placeholder="카테고리 이름"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleAddCategory}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <i className="ri-check-line"></i>
                </button>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryName("");
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCategory(true)}
                className="px-3 py-2 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition flex items-center gap-1 whitespace-nowrap"
              >
                <i className="ri-add-line"></i>
                카테고리 추가
              </button>
            )}
          </div>

          {/* 초안보기 토글 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 whitespace-nowrap">초안보기</label>
            <button
              onClick={() => handleDraftToggle(!showDraftOnly)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                showDraftOnly ? "bg-blue-600" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={showDraftOnly}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  showDraftOnly ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                {/* 체크박스 */}
                <th className="p-3 w-12">
                  <input
                    type="checkbox"
                    checked={
                      paginatedPosts.length > 0 &&
                      selectedIds.length === paginatedPosts.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded cursor-pointer"
                  />
                </th>
                {/* 헤더들 */}
                <th
                  onClick={() => handleSort("created_at")}
                  className="text-left p-3 font-medium text-sm text-gray-700 cursor-pointer hover:bg-gray-200 transition"
                >
                  <div className="flex items-center gap-2">
                    제목
                    {sortBy === "created_at" && (
                      <i className={`ri-arrow-${sortOrder === "desc" ? "down" : "up"}-line text-xs`}></i>
                    )}
                  </div>
                </th>

                <th className="text-left p-3 font-medium text-sm text-gray-700">
                  요약
                </th>
                <th
                  onClick={() => handleSort("created_at")}
                  className="text-left p-3 font-medium text-sm text-gray-700 cursor-pointer hover:bg-gray-200 transition"
                >
                  <div className="flex items-center gap-2">
                    작성일
                    {sortBy === "created_at" && (
                      <i className={`ri-arrow-${sortOrder === "desc" ? "down" : "up"}-line text-xs`}></i>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("published_at")}
                  className="text-left p-3 font-medium text-sm text-gray-700 cursor-pointer hover:bg-gray-200 transition"
                >
                  <div className="flex items-center gap-2">
                    발행일
                    {sortBy === "published_at" && (
                      <i className={`ri-arrow-${sortOrder === "desc" ? "down" : "up"}-line text-xs`}></i>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("view_count")}
                  className="text-left p-3 font-medium text-sm text-gray-700 cursor-pointer hover:bg-gray-200 transition"
                >
                  <div className="flex items-center truncate gap-2">
                    조회수
                    {sortBy === "view_count" && (
                      <i className={`ri-arrow-${sortOrder === "desc" ? "down" : "up"}-line text-xs`}></i>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("scrap_count")}
                  className="text-left p-3 font-medium text-sm text-gray-700 cursor-pointer hover:bg-gray-200 transition"
                >
                  <div className="flex items-center gap-2 truncate">
                    스크랩
                    {sortBy === "scrap_count" && (
                      <i className={`ri-arrow-${sortOrder === "desc" ? "down" : "up"}-line text-xs`}></i>
                    )}
                  </div>
                </th>
                <th className="text-center p-3 font-medium text-sm text-gray-700 truncate">
                  발행상태
                </th>
                <th className="text-center p-3 font-medium text-sm text-gray-700">
                  수정
                </th>
                <th className="text-center p-3 font-medium text-sm text-gray-700">
                  삭제
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedPosts.length > 0 ? (
                paginatedPosts.map((post) => (
                  <tr key={post.id} className="border-b hover:bg-gray-50 transition">
                    {/* 체크박스 */}
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(post.id)}
                        onChange={(e) => handleSelectItem(post.id, e.target.checked)}
                        className="rounded cursor-pointer"
                      />
                    </td>

                    {/* 제목 + 썸네일 */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 bg-gray-100 rounded flex-shrink-0">
                          {post.title_image_url ? (
                            <img
                              src={post.title_image_url}
                              alt={post.title}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <i className="ri-image-line text-lg"></i>
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{post.title}</p>
                      </div>
                    </td>

                    {/* 요약 */}
                    <td className="p-3">
                      <p className="text-sm text-gray-600 line-clamp-2 max-w-xs">{post.summary || "-"}</p>
                    </td>
                    {/* 작성일 */}
                    <td className="p-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(post.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    {/* 발행일 */}
                    <td className="p-3 text-sm text-gray-600 whitespace-nowrap">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                    {/* 조회수 */}
                    <td className="p-3 text-sm text-gray-600 whitespace-nowrap">
                      {post.view_count || 0}
                    </td>
                    {/* 스크랩 */}
                    <td className="p-3 text-sm text-gray-600 whitespace-nowrap">
                      {post.scrap_count || 0}
                    </td>
                    {/* 발행상태 토글 */}
                    <td className="p-3 text-center">
                      {canPublishPost(post) ? (
                        <button
                          onClick={() => handleTogglePublish(post)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            post.is_published ? "bg-green-600" : "bg-gray-300"
                          }`}
                          role="switch"
                          aria-checked={post.is_published}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              post.is_published ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      ) : (
                        <div
                          className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent bg-gray-200 opacity-50 cursor-not-allowed"
                          role="switch"
                          aria-checked={post.is_published}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              post.is_published ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </div>
                      )}
                    </td>
                    {/* 수정 */}
                    <td className="p-3 text-center">
                      {canEditPost(post) ? (
                        <Link
                          href={`/dashboard/contents/blog/${post.id}/edit`}
                          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition inline-block"
                        >
                          수정
                        </Link>
                      ) : (
                        <span className="px-3 py-1.5 text-sm bg-gray-50 text-gray-400 rounded cursor-not-allowed inline-block">
                          수정
                        </span>
                      )}
                    </td>
                    {/* 삭제 */}
                    <td className="p-3 text-center">
                      {canDeletePost(post) ? (
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                        >
                          삭제
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 text-sm bg-gray-50 text-gray-400 rounded cursor-not-allowed">
                          삭제
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-gray-500">
                    포스트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 정보 */}
        <div className="mt-4 text-sm text-gray-600">
          총 {totalCount}개 중 {(page - 1) * limit + 1}-
          {Math.min(page * limit, totalCount)}개 표시
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6 gap-2">
            <button
              onClick={() => updatePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
            >
              이전
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => updatePage(num)}
                className={`px-3 py-1 border rounded ${
                  page === num ? "bg-black text-white" : "hover:bg-gray-100"
                }`}
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => updatePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="p-6">불러오는 중...</div>}>
      <BlogContent />
    </Suspense>
  );
}