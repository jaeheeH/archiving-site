"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

import TagInput from "@/components/TagInput";
import CategorySelectModal from "@/components/CategorySelectModal";
import CategorySelect from "@/components/CategorySelect";

interface EditGalleryClientProps {
  id: string;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function EditGalleryClient({
  id,
  onClose,
  onSaveSuccess,
}: EditGalleryClientProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [geminiTags, setGeminiTags] = useState<string[]>([]);
  const [range, setRange] = useState<string[]>([]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [embedding, setEmbedding] = useState<number[]>([]);
  const [geminiDescription, setGeminiDescription] = useState("");

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

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

  useEffect(() => {
    const load = async () => {
      try {
        // ✅ API 대신 직접 Supabase에서 조회
        const { data, error } = await supabase
          .from("gallery")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.error("조회 에러:", error);
          addToast("데이터를 불러올 수 없습니다", "error");
          setLoading(false);
          return;
        }

        if (data) {
          setTitle(data.title);
          setDescription(data.description || "");
          setImageUrl(data.image_url);
          setTags(data.tags || []);
          setGeminiTags(data.gemini_tags || []);
          setRange(data.range || []);
          setCategory(data.category || "");
          setEmbedding(data.embedding || []);
          setGeminiDescription(data.gemini_description || "");
        }

        setLoading(false);
      } catch (error: any) {
        console.error("로드 에러:", error);
        addToast("데이터 로드 중 오류가 발생했습니다", "error");
        setLoading(false);
      }
    };

    load();
  }, [id, supabase, addToast]);

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `gallery/${fileName}`;

    const { error } = await supabase.storage
      .from("gallery")
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("gallery")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const analyzeImage = async (imageUrl: string) => {
    const res = await fetch("/api/gallery/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl,
        title,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "이미지 분석 실패");
    }

    const data = await res.json();
    return data;
  };

  const save = async () => {
    try {
      setSaving(true);

      let finalImage = imageUrl;
      let finalEmbedding = embedding;
      let finalGeminiDescription = geminiDescription;
      let finalGeminiTags = geminiTags;

      // 새 이미지가 업로드된 경우
      if (imageFile) {
        finalImage = await uploadImage(imageFile);

        // 새 이미지 분석
        const analysisResult = await analyzeImage(finalImage);
        finalEmbedding = analysisResult.embedding;
        finalGeminiDescription = analysisResult.summary;
        finalGeminiTags = Array.isArray(analysisResult.tags) ? analysisResult.tags : [];
      }

      // API를 통해 갤러리 수정
      const res = await fetch(`/api/gallery/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          image_url: finalImage,
          tags,
          category,
          range,
          embedding: finalEmbedding,
          gemini_description: finalGeminiDescription,
          gemini_tags: finalGeminiTags,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "수정 실패");
      }

      addToast("수정 완료!", "success");
      onSaveSuccess();
      onClose();
    } catch (error: any) {
      console.error("save 함수 에러:", error);
      addToast(`저장 중 오류: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">불러오는 중...</div>;

  return (
    <div>
      <div className="flex justify-between items-center modalTitle p-6">
        <h1 className="text-xl font-semibold">갤러리 수정</h1>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ✕
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        <input
          className="input-text-36 border p-2 w-full"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="border p-2 w-full textArea"
          placeholder="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>

        <TagInput tags={tags} setTags={setTags} />

        {geminiTags.length > 0 && (
          <div className="p-2 bg-blue-50 rounded text-sm">
            <p className="font-semibold text-blue-900 mb-1">💡 Gemini 분석 태그:</p>
            <div className="flex flex-wrap gap-1">
              {geminiTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <CategorySelect value={category} setValue={setCategory} />

        <div onClick={() => setRangeOpen(true)} className="border p-2 cursor-pointer">
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

        <div
          className={`
            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
            ${isDragging ? "bg-blue-50 border-blue-400" : "border-gray-300"}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("editImageInput")?.click()}
        >
          <input
            id="editImageInput"
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setImageFile(file);
            }}
          />

          {imageFile ? (
            <img
              src={URL.createObjectURL(imageFile)}
              className="mx-auto max-h-72 rounded"
              alt="미리보기"
            />
          ) : imageUrl ? (
            <img src={imageUrl} className="mx-auto max-h-72 rounded" alt="현재 이미지" />
          ) : (
            <div className="text-gray-400">
              이미지를 드래그하거나 클릭하여 업로드
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 modalBottom p-6">
        <button
          onClick={save}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={saving}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          취소
        </button>
      </div>
    </div>
  );
}