"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Camera, Loader2, Save, UserRound } from "lucide-react";

import { useToast } from "@/components/ToastProvider";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TARGET_IMAGE_SIZE = 320;
const COMPRESSION_QUALITY = 0.9;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type UserProfile = {
  id: string;
  email: string;
  nickname: string;
  name: string;
  phone: string;
  tel: string;
  avatar_url: string | null;
};

type ProfileForm = {
  nickname: string;
  name: string;
  phone: string;
  tel: string;
};

const inputClass =
  "w-full rounded-md border border-[var(--archive-line)] bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#ff4800] focus:ring-2 focus:ring-[#ff4800]/10 disabled:bg-gray-50 disabled:text-gray-500";

export default function ProfileTab({ user }: { user: UserProfile }) {
  const router = useRouter();
  const toastContext = useToast();
  const addToast = toastContext?.addToast || (() => {});

  const [form, setForm] = useState<ProfileForm>({
    nickname: user.nickname || "",
    name: user.name || "",
    phone: user.phone || "",
    tel: user.tel || "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resizeAndCropImage = async (file: File): Promise<File> => {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("이미지 처리에 실패했습니다."));
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
              if (!blob) {
                reject(new Error("이미지 변환에 실패했습니다."));
                return;
              }

              resolve(
                new File([blob], "avatar.webp", {
                  type: "image/webp",
                  lastModified: Date.now(),
                })
              );
            },
            "image/webp",
            COMPRESSION_QUALITY
          );
        };
        img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      };
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    });
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
      addToast("JPG, PNG, WebP 이미지만 업로드할 수 있습니다.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      addToast("5MB 이하 이미지만 선택해주세요.", "error");
      return;
    }

    try {
      const processedFile = await resizeAndCropImage(file);
      const previewUrl = URL.createObjectURL(processedFile);

      setAvatarFile(processedFile);
      setAvatarPreview(previewUrl);
    } catch (error) {
      console.error("Profile image processing failed:", error);
      addToast(error instanceof Error ? error.message : "이미지 처리에 실패했습니다.", "error");
    } finally {
      event.target.value = "";
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const updates = {
      nickname: form.nickname.trim(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      tel: form.tel.trim(),
    };

    if (!updates.nickname) {
      addToast("닉네임을 입력해주세요.", "error");
      return;
    }

    setSaving(true);

    try {
      let avatarUrl = user.avatar_url;

      if (avatarFile) {
        const formData = new FormData();
        formData.append("userId", user.id);
        formData.append("file", avatarFile);

        const uploadRes = await fetch("/api/admin/users/avatar", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json().catch(() => ({}));

        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "이미지 업로드에 실패했습니다.");
        }

        avatarUrl = uploadData.url || avatarUrl;
      }

      const updateRes = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          updates: {
            ...updates,
            avatar_url: avatarUrl,
          },
        }),
      });
      const updateData = await updateRes.json().catch(() => ({}));

      if (!updateRes.ok) {
        throw new Error(updateData.error || "프로필 저장에 실패했습니다.");
      }

      setAvatarFile(null);
      setAvatarPreview(avatarUrl);
      addToast("프로필이 저장되었습니다.", "success");
      router.refresh();
    } catch (error) {
      console.error("Profile save failed:", error);
      addToast(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="w-full max-w-3xl">
      <div className="mb-6">
        <p className="archive-eyebrow mb-3 text-[var(--archive-faint)]">Profile</p>
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">프로필 정보</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--archive-muted)]">계정에 표시되는 기본 정보를 관리합니다.</p>
      </div>

      <form onSubmit={handleSave} className="rounded-lg border border-[var(--archive-line)] bg-white p-6 md:p-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border border-[var(--archive-line)] bg-gray-100">
              {avatarPreview ? (
                avatarPreview.startsWith("blob:") ? (
                  <img src={avatarPreview} alt="프로필 이미지" className="h-full w-full object-cover" />
                ) : (
                  <Image
                    src={avatarPreview}
                    alt="프로필 이미지"
                    fill
                    sizes="112px"
                    priority
                    className="object-cover"
                  />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-gray-400">
                  {form.nickname.charAt(0) || user.email.charAt(0) || "U"}
                </div>
              )}
            </div>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[var(--archive-line)] bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-[#ff4800] hover:text-[#ff4800]">
              <Camera className="h-4 w-4" />
              이미지 변경
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
            </label>
          </div>

          <div className="grid flex-1 gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">이메일</span>
              <input type="email" value={user.email} disabled className={inputClass} />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">닉네임</span>
              <input
                type="text"
                value={form.nickname}
                onChange={(event) => updateField("nickname", event.target.value)}
                className={inputClass}
                placeholder="닉네임"
                maxLength={40}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">이름</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className={inputClass}
                placeholder="이름"
                maxLength={40}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">휴대전화</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className={inputClass}
                  placeholder="010-0000-0000"
                  maxLength={30}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">일반전화</span>
                <input
                  type="tel"
                  value={form.tel}
                  onChange={(event) => updateField("tel", event.target.value)}
                  className={inputClass}
                  placeholder="02-000-0000"
                  maxLength={30}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--archive-line)] pt-5">
          <div className="hidden min-w-0 items-center gap-2 text-xs text-[var(--archive-muted)] sm:flex">
            <UserRound className="h-4 w-4" />
            <span className="truncate">{user.email}</span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-[#ff4800] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "저장 중" : "변경사항 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}
