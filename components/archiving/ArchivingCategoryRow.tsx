"use client";

interface ArchivingCategoryRowProps {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function ArchivingCategoryRow({
  id,
  name,
  description,
  created_at,
  onEdit,
  onDelete,
}: ArchivingCategoryRowProps) {
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
      {/* 범주명 */}
      <td className="p-3 font-medium text-sm">
        <div className="max-w-xs truncate" title={name}>
          {name}
        </div>
      </td>

      {/* 설명 */}
      <td className="p-3 text-sm text-gray-600">
        <div className="max-w-xs truncate" title={description || ""}>
          {description || "-"}
        </div>
      </td>

      {/* 생성일 */}
      <td className="p-3 text-sm text-gray-500">
        {formatDate(created_at)}
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
            if (confirm("이 범주를 삭제하시겠습니까?")) {
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