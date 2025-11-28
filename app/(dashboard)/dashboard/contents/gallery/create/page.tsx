"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import DashboardTitle from "@/app/(dashboard)/components/DashboardHeader";

// UI Components
import TagInput from "@/components/TagInput";
import CategorySelectModal from "@/components/CategorySelectModal";
import CategorySelect from "@/components/CategorySelect";

export default function CreateGalleryPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        alert("로그인이 필요합니다.");
        router.push("/login");
        return;
      }
    };

    checkAuth();
  }, [router]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // 📌 태그
  const [tags, setTags] = useState<string[]>([]);

  // 🟢 범주(Behance 스타일)
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState<string[]>([]);

  const rangeCategories = [
    "UI/UX",
    "산업 디자인",
    "그래픽 디자인",
    "건축",
    "브랜딩",
    "웹 디자인",
    "일러스트레이션",
    "모션 그래픽",
    "패션",
    "사진",
  ];

  // 🟡 카테고리 (기본 + 직접추가)
  const [category, setCategory] = useState("");

  // 이미지 drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setImageFile(file);
  };

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `gallery/${fileName}`;

    const { error } = await supabase.storage
      .from("gallery")
      .upload(filePath, file);

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("gallery")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const analyzeImage = async (imageUrl: string) => {
    const res = await fetch("/api/gallery/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, title }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "이미지 분석 실패");
    }

    const data = await res.json();
    return data;
  };

  const handleSubmit = async () => {
    if (!title) return alert("제목을 입력하세요.");
    if (!imageFile) return alert("이미지를 업로드하세요.");

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        addToast("사용자 정보를 찾을 수 없습니다.", "error");
        return;
      }

      // 1. Storage에 이미지 업로드
      const imageUrl = await uploadImage(imageFile);

      // 2. Gemini로 이미지 분석
      const analysisResult = await analyzeImage(imageUrl);

      // 3. API를 통해 gallery 생성
      const aiTags = Array.isArray(analysisResult.tags) ? analysisResult.tags : [];

      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          image_url: imageUrl,
          tags: [...tags, ...aiTags],
          category,
          range,
          embedding: analysisResult.embedding,
          gemini_description: analysisResult.summary,
          gemini_tags: aiTags,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "저장 실패");
      }

      addToast("저장 완료!", "success");
      router.push("/dashboard/contents/gallery/");
    } catch (e: any) {
      console.error("❌ 에러:", e);
      addToast(`에러: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="dashboard-Header">
        <DashboardTitle title="갤러리 목록" />
        <div className="flex gap-2 items-center">
          <button
            className="btn-line-36 "
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "업로드 중..." : "저장하기"}
          </button>
        </div>
      </header>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4">
        {/* 📌 제목 */}
        <div className="form-label" data-label="제목">
          <label htmlFor="gallery-title">제목</label>
          <input
            className="border p-2 rounded w-full input-text-36"
            placeholder="제목"
            value={title}
            id="gallery-title"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* 📌 설명 */}
        <div className="form-label">
          <label htmlFor="">설명</label>
          <textarea
            className="border p-2 rounded w-full textArea"
            placeholder="설명"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* 📌 태그 */}
        <div className="form-label">
          <label>태그</label>
          <TagInput tags={tags} setTags={setTags} />
          <p className="text-sm text-gray-500 mt-1">
            💡 Gemini가 자동으로 생성한 태그도 추가됩니다.
          </p>
        </div>

        {/* 🟢 범주 */}
        <div className="form-label">
          <label className="block mb-1 font-medium">범주</label>

          <div
            className="border rounded p-2 cursor-pointer"
            onClick={() => setRangeOpen(true)}
          >
            {range.length === 0 ? "범주 선택" : range.join(", ")}
          </div>

          <CategorySelectModal
            open={rangeOpen}
            setOpen={setRangeOpen}
            selected={range}
            setSelected={setRange}
            categories={rangeCategories}
            max={3}
          />
        </div>

        {/* 🟡 카테고리 */}
        <div className="form-label">
          <label className="block mb-1 font-medium">카테고리</label>
          <CategorySelect value={category} setValue={setCategory} />
        </div>

        {/* 📌 이미지 drag & drop */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
            isDragging ? "bg-blue-50 border-blue-400" : "border-gray-300"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <input
            type="file"
            id="fileInput"
            hidden
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) setImageFile(e.target.files[0]);
            }}
          />

          {!imageFile ? (
            <div className="text-gray-500">
              이미지를 드래그하거나 클릭하여 업로드
            </div>
          ) : (
            <img
              src={URL.createObjectURL(imageFile)}
              className="mx-auto max-h-72 rounded"
            />
          )}
        </div>
      </div>
    </div>
  );
}