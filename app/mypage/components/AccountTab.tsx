"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export default function AccountTab() {
  const router = useRouter();
  const supabase = createClient();
  const toastContext = useToast();
  const addToast = toastContext?.addToast || (() => {});

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  // 비밀번호 변경
  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      alert("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    try {
      // Supabase에서 비밀번호 변경
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      addToast("비밀번호가 변경되었습니다.", "success");
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      console.error("Password change error:", error);
      alert("비밀번호 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 회원 탈퇴
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "회원탈퇴") {
      alert("'회원탈퇴'를 정확히 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // 사용자 데이터 삭제 (users 테이블)
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);

      if (deleteError) throw deleteError;

      // 로그아웃
      await supabase.auth.signOut();

      addToast("회원 탈퇴가 완료되었습니다.", "success");
      router.push("/");
    } catch (error) {
      console.error("Delete account error:", error);
      alert("회원 탈퇴 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">계정 설정</h2>
      <div className="bg-white rounded-lg border p-6 space-y-6">
        {/* <div className="flex justify-between items-center pb-6 border-b">
          <div>
            <h3 className="font-medium">비밀번호 변경</h3>
            <p className="text-sm text-gray-500">주기적인 변경으로 계정을 보호하세요.</p>
          </div>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="border px-4 py-2 rounded text-sm hover:bg-gray-50 transition-colors"
          >
            변경
          </button>
        </div> */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium text-red-600">회원 탈퇴</h3>
            <p className="text-sm text-gray-500">계정과 모든 데이터가 삭제됩니다.</p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="border border-red-200 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50 transition-colors"
          >
            탈퇴
          </button>
        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">비밀번호 변경</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">현재 비밀번호</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">새 비밀번호</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                }}
                className="flex-1 border px-4 py-2 rounded text-sm hover:bg-gray-50"
                disabled={loading}
              >
                취소
              </button>
              <button
                onClick={handlePasswordChange}
                className="flex-1 bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "변경 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 탈퇴 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4 text-red-600">회원 탈퇴</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                정말로 탈퇴하시겠습니까? 모든 데이터가 영구적으로 삭제됩니다.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                탈퇴를 진행하시려면 아래에 <strong>'회원탈퇴'</strong>를 입력해주세요.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="회원탈퇴"
                className="w-full border border-red-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                className="flex-1 border px-4 py-2 rounded text-sm hover:bg-gray-50"
                disabled={loading}
              >
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                disabled={loading || deleteConfirmText !== "회원탈퇴"}
              >
                {loading ? "처리 중..." : "탈퇴"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
