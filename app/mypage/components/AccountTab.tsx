"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, ShieldCheck, Trash2, X } from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";

type PasswordForm = {
  newPassword: string;
  confirmPassword: string;
};

type LoadingAction = "password" | "delete" | null;

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-100";

export default function AccountTab({ email }: { email: string }) {
  const router = useRouter();
  const supabase = createClient();
  const toastContext = useToast();
  const addToast = toastContext?.addToast || (() => {});

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  const resetPasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({ newPassword: "", confirmPassword: "" });
  };

  const resetDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteConfirmText("");
  };

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      addToast("새 비밀번호를 입력해주세요.", "error");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast("새 비밀번호가 일치하지 않습니다.", "error");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      addToast("비밀번호는 8자 이상이어야 합니다.", "error");
      return;
    }

    setLoadingAction("password");

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      addToast("비밀번호가 변경되었습니다.", "success");
      resetPasswordModal();
    } catch (error) {
      console.error("Password change failed:", error);
      addToast("비밀번호 변경에 실패했습니다.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (deleteConfirmText !== "회원탈퇴") {
      addToast("'회원탈퇴'를 정확히 입력해주세요.", "error");
      return;
    }

    setLoadingAction("delete");

    try {
      const response = await fetch("/api/mypage/account", { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "회원 탈퇴 처리에 실패했습니다.");
      }

      await supabase.auth.signOut();
      addToast("회원 탈퇴가 완료되었습니다.", "success");
      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error("Delete account failed:", error);
      addToast(error instanceof Error ? error.message : "회원 탈퇴 처리 중 오류가 발생했습니다.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSignOut = async () => {
    setLoadingAction("delete");

    try {
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setLoadingAction(null);
    }
  };

  const isBusy = loadingAction !== null;

  return (
    <section className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-950">계정 설정</h2>
        <p className="mt-1 text-sm text-gray-500">로그인 정보와 계정 상태를 관리합니다.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-950">
              <ShieldCheck className="h-4 w-4 text-gray-500" />
              로그인 계정
            </div>
            <p className="mt-1 text-sm text-gray-500">{email || "이메일 정보 없음"}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isBusy}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>

        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-950">
              <KeyRound className="h-4 w-4 text-gray-500" />
              비밀번호
            </div>
            <p className="mt-1 text-sm text-gray-500">이메일 로그인 비밀번호를 변경합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            disabled={isBusy}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            변경
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
              <Trash2 className="h-4 w-4" />
              회원 탈퇴
            </div>
            <p className="mt-1 text-sm text-gray-500">계정과 개인 저장 기록이 삭제됩니다.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            disabled={isBusy}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            탈퇴
          </button>
        </div>
      </div>

      {showPasswordModal && (
        <Modal title="비밀번호 변경" onClose={resetPasswordModal}>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">새 비밀번호</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                className={inputClass}
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">새 비밀번호 확인</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                className={inputClass}
                minLength={8}
                autoComplete="new-password"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetPasswordModal}
                className="flex-1 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isBusy}
              >
                취소
              </button>
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                disabled={isBusy}
              >
                {loadingAction === "password" && <Loader2 className="h-4 w-4 animate-spin" />}
                변경
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal title="회원 탈퇴" onClose={resetDeleteModal} tone="danger">
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <div className="rounded-md border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
              탈퇴 후에는 같은 계정의 저장 기록을 복구할 수 없습니다.
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">확인 문구</span>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="회원탈퇴"
                className="w-full rounded-md border border-red-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetDeleteModal}
                className="flex-1 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isBusy}
              >
                취소
              </button>
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={isBusy || deleteConfirmText !== "회원탈퇴"}
              >
                {loadingAction === "delete" && <Loader2 className="h-4 w-4 animate-spin" />}
                탈퇴
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function Modal({
  title,
  tone = "default",
  onClose,
  children,
}: {
  title: string;
  tone?: "default" | "danger";
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className={`text-lg font-semibold ${tone === "danger" ? "text-red-600" : "text-gray-950"}`}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
