"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { User } from "./UserList";

type Props = {
  user: User;
  isSelected: boolean;
  onSelect: (userId: string, checked: boolean) => void;
  canEdit: boolean;
  canChangeRole: boolean;  // 추가
  canDelete: boolean;      // 추가
  onEdit: () => void;
  onUpdateUser: (userId: string, updates: Partial<User>) => Promise<boolean>;
  onDeleteUser: (userId: string) => Promise<boolean>;
  currentUserRole: string;
  currentUserId: string;
};

const ROLES = ["user", "editor", "sub-admin", "admin"] as const;

export default function UserRow({
  user,
  isSelected,
  onSelect,
  canEdit,
  canChangeRole,  // 추가
  canDelete,      // 추가
  onEdit,
  onUpdateUser,
  onDeleteUser,
  currentUserRole,
  currentUserId,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLTableDataCellElement>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 역할 뱃지 스타일
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-700 border-red-200";
      case "sub-admin":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "editor":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // 상태 표시
  const getStatusDisplay = (status: string | null) => {
    if (status === "active" || status === null) {
      return (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Active
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
        Inactive
      </span>
    );
  };

  // 날짜 포맷
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // 선택 가능한 역할 목록
  const getSelectableRoles = () => {
    if (currentUserRole === "admin") return ROLES;
    if (currentUserRole === "sub-admin") return ROLES.filter((r) => r !== "admin");
    return [];
  };

  // 삭제 처리
  const handleDelete = async () => {
    const success = await onDeleteUser(user.id);
    if (success) {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      {/* 체크박스 */}
      <td className="p-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(user.id, e.target.checked)}
          className="rounded"
        />
      </td>

      {/* 닉네임 + 아바타 */}
      <td className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.nickname || ""}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                {user.nickname?.charAt(0) || user.email?.charAt(0) || "?"}
              </div>
            )}
          </div>
          <span className="font-medium text-sm">{user.nickname || "-"}</span>
        </div>
      </td>

      {/* 계정 (이메일) */}
      <td className="p-3 text-gray-600 text-sm">{user.email}</td>

      {/* 이름 */}
      <td className="p-3 text-sm">{user.name || "-"}</td>

      {/* 역할 */}
      <td className="p-3 text-sm">
        {canChangeRole ? (
          <select
            value={user.role}
            onChange={(e) => onUpdateUser(user.id, { role: e.target.value })}
            className={`px-2 py-1 rounded border text-sm ${getRoleBadgeStyle(user.role)}`}
          >
            {getSelectableRoles().map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        ) : (
          <span className={`px-2 py-1 rounded border text-sm ${getRoleBadgeStyle(user.role)}`}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </span>
        )}
      </td>

      {/* 휴대전화 */}
      <td className="p-3 text-gray-600 text-sm">{user.phone || "-"}</td>

      {/* 일반전화 */}
      <td className="p-3 text-gray-600 text-sm">{user.tel || "-"}</td>

      {/* 가입일 */}
      <td className="p-3 text-gray-600 text-sm">{formatDate(user.created_at)}</td>

      {/* 최종 로그인 */}
      <td className="p-3 text-gray-600 text-sm">{formatDate(user.last_login_at)}</td>

      {/* 상태 */}
      <td className="p-3 text-sm">{getStatusDisplay(user.status)}</td>

      {/* 더보기 메뉴 */}
      <td className="p-3 relative text-sm" ref={menuRef}>
        {canEdit && (
          <>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white border rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    onEdit();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  수정하기
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  알림
                </button>
                {canDelete && (
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600"
                  >
                    삭제하기
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm">
              <h3 className="text-lg font-semibold mb-4">사용자 삭제</h3>
              <p className="text-gray-600 mb-6">
                정말 <strong>{user.nickname || user.email}</strong>을(를) 삭제하시겠습니까?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}