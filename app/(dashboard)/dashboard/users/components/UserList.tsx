"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserRow from "./UserRow";
import UserEditModal from "./UserEditModal";

export type User = {
  id: string;
  email: string;
  role: string;
  nickname: string | null;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  tel: string | null;
  created_at: string;
  last_login_at: string | null;
  status: string;
};

type Props = {
  users: User[];
  currentUserRole: string;
  currentUserId: string;
};

export default function UserList({ users, currentUserRole, currentUserId }: Props) {
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // 검색 필터
  const filteredUsers = users.filter((user) => {
    const searchLower = search.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.nickname?.toLowerCase().includes(searchLower) ||
      user.name?.toLowerCase().includes(searchLower) ||
      user.phone?.includes(search)
    );
  });

  // 전체 선택
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(filteredUsers.map((user) => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  // 개별 선택
  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    }
  };

  // 역할 변경 가능 여부
  // 수정 가능 여부 (메뉴 표시 여부)
  const canEditUser = (targetRole: string, targetId: string) => {
    // 본인
    if (targetId === currentUserId) return true;
    
    // admin은 모든 사용자 수정 가능
    if (currentUserRole === "admin") return true;
    
    // sub-admin은 admin 제외 수정 가능
    if (currentUserRole === "sub-admin" && targetRole !== "admin") return true;
    
    // editor/user는 본인만 (위에서 처리됨)
    return false;
  };

  // 역할 변경 가능 여부
  const canChangeRole = (targetRole: string, targetId: string) => {
    // 본인은 역할 변경 불가
    if (targetId === currentUserId) return false;
    
    // admin은 모든 사용자 역할 변경 가능
    if (currentUserRole === "admin") return true;
    
    // sub-admin은 admin 제외 역할 변경 가능
    if (currentUserRole === "sub-admin" && targetRole !== "admin") return true;
    
    return false;
  };

  // 삭제 가능 여부
  const canDeleteUser = (targetRole: string, targetId: string) => {
    // 본인은 삭제 불가
    if (targetId === currentUserId) return false;
    
    // admin은 모든 사용자 삭제 가능
    if (currentUserRole === "admin") return true;
    
    // sub-admin은 admin 제외 삭제 가능
    if (currentUserRole === "sub-admin" && targetRole !== "admin") return true;
    
    return false;
  };

  // 사용자 정보 업데이트
  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId);

    if (error) {
      alert("업데이트에 실패했습니다.");
      console.error(error);
      return false;
    }

    router.refresh();
    return true;
  };

  // 사용자 삭제
  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "삭제에 실패했습니다.");
        return false;
      }

      alert("사용자가 완전히 삭제되었습니다.");
      router.refresh();
      return true;
    } catch (error) {
      console.error("Delete error:", error);
      alert("삭제 중 오류가 발생했습니다.");
      return false;
    }
  };

  // 상태 일괄 변경
  const handleBulkStatusChange = async (status: string) => {
    if (selectedUsers.length === 0) return;

    const { error } = await supabase
      .from("users")
      .update({ status })
      .in("id", selectedUsers);

    if (error) {
      alert("상태 변경에 실패했습니다.");
    } else {
      setSelectedUsers([]);
      router.refresh();
    }
  };

  return (
    <div>
      {/* 상단 검색 & 필터 */}
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-4 py-2 pl-10 w-64"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex gap-2">
          {selectedUsers.length > 0 && (
            <>
              <button
                onClick={() => handleBulkStatusChange("active")}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100"
              >
                활성화
              </button>
              <button
                onClick={() => handleBulkStatusChange("inactive")}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100"
              >
                비활성화
              </button>
            </>
          )}

        </div>
      </div>

      {/* 테이블 */}
      <div className="border  ">
        <table className="w-full userTable">
          <thead className="bg-gray-200 border-b overflow-hidden">
            <tr>
              <th className="p-3 ">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">닉네임</th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">계정</th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">이름</th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">역할</th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">휴대전화</th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">일반전화</th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">가입일</th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">최종 로그인</th>
              <th className="text-left p-3 font-medium text-sm text-gray-600">상태</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelected={selectedUsers.includes(user.id)}
                onSelect={handleSelectUser}
                canEdit={canEditUser(user.role, user.id)}
                canChangeRole={canChangeRole(user.role, user.id)}  // 추가
                canDelete={canDeleteUser(user.role, user.id)}      // 추가
                onEdit={() => setEditingUser(user)}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                currentUserRole={currentUserRole}
                currentUserId={currentUserId}
              />
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <p className="text-center text-gray-500 py-8">사용자가 없습니다.</p>
        )}
      </div>

      {/* 수정 모달 */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  );
}