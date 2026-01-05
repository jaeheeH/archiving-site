"use client";

import { useState } from "react";

interface ReferenceTableRowProps {
  id: number;
  title: string;
  description: string | null;
  url: string;
  image_url: string;
  clicks: number;
  created_at: string;
  isSelected: boolean;
  onSelect: (id: number, selected: boolean) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function ReferenceTableRow({
  id,
  title,
  description,
  url,
  image_url,
  clicks,
  created_at,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: ReferenceTableRowProps) {
  // URL 도메인 추출 (표시용)
  const getDisplayUrl = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname;
    } catch {
      return urlString;
    }
  };

  // 텍스트 줄임말 처리 (2줄)
  const truncateText = (text: string | null, lines: number = 2) => {
    if (!text) return "";
    const lineArray = text.split("\n").slice(0, lines);
    return lineArray.join("\n");
  };

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <tr className="border-b hover:bg-gray-50 transition">
      {/* 체크박스 */}
      <td className="p-3 w-12">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(id, e.target.checked)}
          className="rounded cursor-pointer"
        />
      </td>

      {/* 이미지 + 제목 */}
      <td className="p-3">
        <div className="flex gap-3 items-center">
          {/* 이미지 */}
          <img
            src={`${image_url}?width=48&height=32&resize=cover`}
            alt={title}
            className="w-12 h-8 rounded flex-shrink-0 object-cover"
            onError={(e) => {
              // 이미지 로드 실패 시 원본 이미지 시도
              const target = e.target as HTMLImageElement;
              if (target.src.includes("width=48")) {
                target.src = image_url;
              } else {
                target.style.backgroundColor = "#e5e7eb";
              }
            }}
          />
          {/* 제목 */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" title={title}>
              {title}
            </p>
          </div>
        </div>
      </td>

      {/* 설명 - 2줄까지만 */}
      <td className="p-3 text-sm text-gray-600">
        <div 
          className="max-w-xs line-clamp-2"
          title={description || ""}
        >
          {description || "-"}
        </div>
      </td>

      {/* URL - 전체 URL */}
      <td className="p-3 text-sm text-blue-600">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate block hover:underline max-w-xs"
          title={url}
        >
          {url}
        </a>
      </td>

      {/* 클릭수 */}
      <td className="p-3 text-sm text-center font-medium">
        {clicks}
      </td>

      {/* 액션 - 수정 버튼 */}
      <td className="p-3">
        <button
          onClick={() => onEdit(id)}
          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
          title="수정"
        >
          <i className="ri-edit-line mr-1"></i>
          수정
        </button>
      </td>

      {/* 액션 - 삭제 버튼 */}
      <td className="p-3">
        <button
          onClick={() => {
            if (confirm("이 레퍼런스를 삭제하시겠습니까?")) {
              onDelete(id);
            }
          }}
          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
          title="삭제"
        >
          <i className="ri-delete-bin-line mr-1"></i>
          삭제
        </button>
      </td>
    </tr>
  );
}