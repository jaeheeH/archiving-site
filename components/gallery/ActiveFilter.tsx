"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function ActiveFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // URL에서 tags 파라미터를 가져옴
  const rawTags = searchParams.get("tags");

  // 태그가 없으면 렌더링하지 않음
  if (!rawTags) return null;

  // 콤마(,)로 구분된 문자열을 배열로 변환
  const activeTags = rawTags.split(",").filter(Boolean);

  // 1. 개별 태그 삭제 핸들러
  const removeTag = (tagToRemove: string) => {
    // 선택한 태그를 제외한 나머지 태그들만 남김
    const newTags = activeTags.filter((tag) => tag !== tagToRemove);
    const params = new URLSearchParams(searchParams.toString());

    if (newTags.length > 0) {
      // 남은 태그가 있으면 다시 콤마로 합쳐서 설정
      params.set("tags", newTags.join(","));
    } else {
      // 남은 태그가 없으면 파라미터 자체를 삭제
      params.delete("tags");
    }
    
    // 필터 변경 시 페이지를 1페이지로 리셋
    params.set("page", "1");
    
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // 2. 전체 초기화 핸들러
  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tags");
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-8 animate-in fade-in slide-in-from-top-1 duration-300">
      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide mr-2">
        Filtered by
      </span>
      
      {/* 개별 태그 렌더링 */}
      {activeTags.map((tag) => (
        <span 
          key={tag} 
          className="inline-flex items-center gap-1.5 bg-black text-white pl-3 pr-2 py-1.5 rounded-full text-sm shadow-sm transition-all hover:bg-gray-800"
        >
          <span className="font-medium">#{tag}</span>
          <button 
            onClick={() => removeTag(tag)}
            className="flex items-center justify-center w-5 h-5 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title={`Remove ${tag}`}
          >
            <i className="ri-close-line text-sm"></i>
          </button>
        </span>
      ))}

      {/* 태그가 2개 이상일 때만 'Clear all' 버튼 표시 */}
      {activeTags.length > 1 && (
        <button 
          onClick={clearAll}
          className="ml-2 text-xs text-gray-500 hover:text-black underline underline-offset-4 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}