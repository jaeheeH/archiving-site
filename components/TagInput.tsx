"use client";

import { useState } from "react";

export default function TagInput({ tags, setTags }: any) {
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
    <div className="border rounded p-2 flex flex-wrap gap-2 tag-box">
      {tags.map((tag: string) => (
        <div
          key={tag}
          className="tag-item"
        >
          {editingTag === tag ? (
            // 🔧 수정 모드
            <input
              autoFocus
              className="outline-none  tag-input"
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
                className="ml-1 text-gray-500"
                onClick={() => deleteTag(tag)}
              >
                <i className="ri-close-line"></i>
              </button>
            </>
          )}
        </div>
      ))}

      {/* 새 태그 추가 input */}
      <input
        className="outline-none tag-input
        
        "
        placeholder="Tags"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && addTag()}
      />
    </div>
  );
}
