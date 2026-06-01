"use client";

import { useState } from "react";

type TagInputProps = {
  tags: string[];
  setTags: (tags: string[]) => void;
};

export default function TagInput({ tags, setTags }: TagInputProps) {
  const [value, setValue] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const addTag = () => {
    if (!value.trim()) return;
    if (tags.includes(value.trim())) return;

    setTags([...tags, value.trim()]);
    setValue("");
  };

  const deleteTag = (tag: string) => {
    setTags(tags.filter((t: string) => t !== tag));
  };

  const startEdit = (tag: string) => {
    setEditingTag(tag);
    setEditValue(tag);
  };

  const saveEdit = () => {
    if (!editingTag) return;

    const trimmed = editValue.trim();
    if (!trimmed) {
      // 빈 값이면 삭제로 처리
      deleteTag(editingTag);
      setEditingTag(null);
      return;
    }

    if (tags.includes(trimmed) && trimmed !== editingTag) {
      alert("이미 존재하는 태그입니다.");
      return;
    }

    setTags(tags.map((t: string) => (t === editingTag ? trimmed : t)));
    setEditingTag(null);
  };

  return (
    <div className="flex min-h-11 flex-wrap gap-2 border border-gray-200 bg-white px-2.5 py-2">
      {tags.map((tag: string) => (
        <div
          key={tag}
          className="inline-flex items-center bg-gray-100 px-2 py-1 text-xs text-gray-700"
        >
          {editingTag === tag ? (
            <input
              autoFocus
              className="w-20 bg-transparent outline-none"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setEditingTag(null);
              }}
              onBlur={saveEdit}
            />
          ) : (
            // 기본 모드
            <>
              <span onClick={() => startEdit(tag)} className="cursor-pointer">
                {tag}
              </span>
              <button
                className="ml-1 text-gray-400 hover:text-gray-900"
                onClick={() => deleteTag(tag)}
                type="button"
              >
                <i className="ri-close-line"></i>
              </button>
            </>
          )}
        </div>
      ))}

      <input
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-300"
        placeholder="Tags"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && addTag()}
      />
    </div>
  );
}
