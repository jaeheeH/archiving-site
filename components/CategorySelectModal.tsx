"use client";

import { useState } from "react";

export default function CategorySelectModal({
  open,
  setOpen,
  selected,
  setSelected,
  max = 3,
  categories,
}: any) {
  const [search, setSearch] = useState("");

  const filtered = categories.filter((c: string) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (cat: string) => {
    const exists = selected.includes(cat);

    if (exists) {
      setSelected(selected.filter((c: string) => c !== cat));
    } else {
      if (selected.length >= max) {
        alert(`최대 ${max}개까지 선택 가능합니다.`);
        return;
      }
      setSelected([...selected, cat]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-3">
          범주 선택 (최대 {max}개)
        </h2>

        <input
          className="border w-full p-2 rounded mb-3"
          placeholder="검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-2">
          {filtered.map((cat: string) => (
            <label className="flex items-center gap-2" key={cat}>
              <input
                type="checkbox"
                checked={selected.includes(cat)}
                onChange={() => toggle(cat)}
              />
              {cat}
            </label>
          ))}
        </div>

        <button
          className="w-full mt-4 bg-blue-600 text-white py-2 rounded"
          onClick={() => setOpen(false)}
        >
          완료
        </button>
      </div>
    </div>
  );
}
