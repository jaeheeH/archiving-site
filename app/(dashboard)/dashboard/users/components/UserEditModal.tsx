"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import imageCompression from 'browser-image-compression';
import type { User } from "./UserList";

type Props = {
  user: User;
  onClose: () => void;
  onSave: (userId: string, updates: Partial<User>) => Promise<boolean>;
  currentUserRole: string;
};

export default function UserEditModal({ user, onClose, onSave, currentUserRole }: Props) {
  const [form, setForm] = useState({
    nickname: user.nickname || "",
    name: user.name || "",
    phone: user.phone || "",
    tel: user.tel || "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // 이미지 리사이징 & 크롭 함수
  const resizeAndCropImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new window.Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // 목표 크기
          const targetSize = 320;
          canvas.width = targetSize;
          canvas.height = targetSize;

          // 정사각형 크롭을 위한 계산 (상단 기준)
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;  // 가로는 중앙
          const y = 0;  // 세로는 상단부터 (기존: (img.height - size) / 2)

          // 크롭 & 리사이징
          ctx.drawImage(
            img,
            x, y, size, size,  // 소스 영역 (정사각형, 상단 기준)
            0, 0, targetSize, targetSize  // 대상 영역
          );

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const resizedFile = new File([blob], file.name, {
                  type: 'image/webp',
                  lastModified: Date.now(),
                });
                resolve(resizedFile);
              } else {
                reject(new Error('Blob creation failed'));
              }
            },
            'image/webp',
            1
          );
        };
      };
      reader.onerror = reject;
    });
  };

  // 이미지 선택
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 2MB 체크
    if (file.size > 2 * 1024 * 1024) {
      alert("이미지는 2MB 이하만 업로드 가능합니다.");
      return;
    }

    try {
      // 리사이징 & 크롭
      const resizedFile = await resizeAndCropImage(file);
      
      setAvatarFile(resizedFile);
      setAvatarPreview(URL.createObjectURL(resizedFile));
    } catch (error) {
      console.error('Image processing error:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    }
  };

  // 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let avatarUrl = user.avatar_url;

    // 이미지 업로드
    if (avatarFile) {
      const fileExt = 'webp';  // 항상 webp로 저장
      const fileName = `${user.id}/${user.id}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, avatarFile, {
          upsert: true,
          contentType: 'image/webp'
        });

      if (uploadError) {
        alert("이미지 업로드에 실패했습니다.");
        console.error(uploadError);
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    }

    // 사용자 정보 업데이트
    const success = await onSave(user.id, {
      ...form,
      avatar_url: avatarUrl,
    });

    setLoading(false);
    if (success) onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">사용자 정보 수정</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 프로필 이미지 */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200">
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="프로필"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                  {form.nickname?.charAt(0) || user.email?.charAt(0) || "?"}
                </div>
              )}
            </div>
            <label className="text-sm text-blue-600 cursor-pointer hover:underline">
              이미지 변경
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>

          {/* 이메일 (읽기 전용) */}
          <div className="form-label">
            <label>이메일</label>
            <input
              type="text"
              value={user.email}
              disabled
              className="input-text-36 border w-full "
            />
          </div>

          {/* 닉네임 */}
          <div className="form-label">
            <label>닉네임</label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full input-text-36 border"
              placeholder="노출용 닉네임"
            />
          </div>

          {/* 이름 */}
          <div className="form-label">
            <label className="">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border input-text-36"
              placeholder="관리용 실명"
            />
          </div>

          {/* 휴대전화 */}
          <div className="form-label">
            <label>휴대전화</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border input-text-36"
              placeholder="010-0000-0000"
            />
          </div>

          {/* 일반전화 */}
          <div className="form-label">
            <label>일반전화</label>
            <input
              type="text"
              value={form.tel}
              onChange={(e) => setForm({ ...form, tel: e.target.value })}
              className="w-full border input-text-36"
              placeholder="02-000-0000"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border btn-line-48"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-line-48 btn-sumit"
            >
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}