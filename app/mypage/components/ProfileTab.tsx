"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const TARGET_IMAGE_SIZE = 320; // 320x320px
const COMPRESSION_QUALITY = 0.9;

// 상위 페이지에서 유저 정보를 넘겨받을 수도 있지만,
// 독립적인 동작을 위해 여기서도 데이터를 관리할 수 있도록 구성합니다.
type UserProfile = {
  id: string;
  email?: string;
  nickname: string;
  avatar_url: string | null;
};

export default function ProfileTab({ user }: { user: UserProfile }) {
  const router = useRouter();
  const supabase = createClient();
  
  const [nickname, setNickname] = useState(user.nickname || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // 이미지 리사이징 & 크롭 로직
  const resizeAndCropImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    };

    const compressedFile = await imageCompression(file, options);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onload = (e) => {
        const img = new window.Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context 생성 실패"));
            return;
          }

          canvas.width = TARGET_IMAGE_SIZE;
          canvas.height = TARGET_IMAGE_SIZE;

          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;
          const y = (img.height - size) / 2;

          ctx.drawImage(img, x, y, size, size, 0, 0, TARGET_IMAGE_SIZE, TARGET_IMAGE_SIZE);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: "image/webp", lastModified: Date.now() }));
              } else {
                reject(new Error("이미지 변환 실패"));
              }
            },
            "image/webp",
            COMPRESSION_QUALITY
          );
        };
        img.onerror = () => reject(new Error("이미지 로드 실패"));
      };
      reader.onerror = () => reject(new Error("파일 읽기 실패"));
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("5MB 이하 이미지만 가능합니다.");
      return;
    }

    try {
      const processedFile = await resizeAndCropImage(file);
      setAvatarFile(processedFile);

      // 이전 프리뷰 URL 메모리 해제
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }

      setAvatarPreview(URL.createObjectURL(processedFile));
    } catch (error) {
      console.error(error);
      alert("이미지 처리에 실패했습니다. 다른 이미지를 선택해주세요.");
    }
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      let publicUrl = user.avatar_url;

      if (avatarFile) {
        const filePath = `${user.id}/${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, avatarFile, { upsert: true });
        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error("이미지 업로드에 실패했습니다.");
        }

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({ nickname: nickname.trim(), avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error("프로필 업데이트에 실패했습니다.");
      }

      alert("프로필이 저장되었습니다.");
      router.refresh();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">프로필 정보</h2>
      <div className="bg-white rounded-lg border p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* 이미지 영역 */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-28 h-28 rounded-full overflow-hidden bg-gray-100 border group">
              {avatarPreview ? (
                <Image src={avatarPreview} alt="Profile" fill sizes="112px" priority className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400 font-bold">
                  {nickname.charAt(0)}
                </div>
              )}
              <label className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                변경
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            </div>
          </div>

          {/* 폼 영역 */}
          <div className="flex-1 w-full space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">이메일</label>
              <input type="text" value={user.email} disabled className="w-full bg-gray-50 border rounded px-3 py-2 text-gray-500 text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">닉네임</label>
              <input 
                type="text" 
                value={nickname} 
                onChange={(e) => setNickname(e.target.value)} 
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
            <div className="flex justify-end pt-4">
              <button 
                onClick={handleSave} 
                disabled={saving} 
                className="bg-black text-white px-5 py-2 rounded text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "변경사항 저장"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}