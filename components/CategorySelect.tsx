"use client";

import { useState } from "react";

export default function CategorySelect({ value, setValue }: any) {
  const baseCategories = ["Midjourney", "GPT", "Stable Diffusion", "Photoshop", "Blender"];

  const [custom, setCustom] = useState("");
  const all = [...baseCategories, ...(custom ? [custom] : [])];

  return (
    <div>
      <select
        className="border p-2 rounded w-full"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="">카테고리 선택</option>
        {all.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <input
        className="border p-2 rounded mt-2 w-full"
        placeholder="새 카테고리 추가"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
      />
    </div>
  );
}
