'use client';

import { useEffect, useState } from 'react';
import TagInput from '@/components/TagInput';

interface Category {
  id: string;
  name: string;
}

interface MetaDataProps {
  categoryId: string;
  onCategoryChange: (id: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function MetaData({
  categoryId,
  onCategoryChange,
  tags,
  onTagsChange,
}: MetaDataProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/posts/categories?type=blog');
        const data = await res.json();
        setCategories(data.categories || []);
      } catch (error) {
        console.error('카테고리 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  if (loading) return <div className="text-sm text-gray-400">로딩 중...</div>;

  return (
    <div className="grid gap-5">
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Category</label>
        <select
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="h-10 w-full border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-gray-900"
        >
          <option value="">카테고리 선택</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Tags</label>
        <TagInput tags={tags} setTags={onTagsChange} />
      </div>
    </div>
  );
}
