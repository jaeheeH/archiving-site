"use client";

import { useEffect, useState } from "react";

export default function EditGalleryPage({ params }) {
  const id = params.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    fetch(`/api/gallery/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setTitle(data.title);
        setDescription(data.description);
        setImageUrl(data.image_url);
      });
  }, [id]);

  const update = async () => {
    const res = await fetch(`/api/gallery/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title,
        description,
        image_url: imageUrl,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "수정 실패");
      return;
    }

    alert("수정 완료");
  };

  return (
    <div className="p-6">
      <h1 className="text-xl mb-4">갤러리 수정</h1>

      <input
        className="border p-2 w-full mb-3"
        placeholder="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        className="border p-2 w-full mb-3"
        placeholder="설명"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <input
        className="border p-2 w-full mb-3"
        placeholder="이미지 URL (임시)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />

      <button
        className="bg-black text-white px-4 py-2 rounded"
        onClick={update}
      >
        수정 저장
      </button>
    </div>
  );
}
