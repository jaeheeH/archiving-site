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

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="grid grid-cols-2 gap-4 mb-5">
      <div>
        <label className="block mb-2 font-semibold text-gray-700">카테고리:</label>
        <select
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <label className="block mb-2 font-semibold text-gray-700">태그:</label>
        <TagInput tags={tags} setTags={onTagsChange} />
      </div>
    </div>
  );
}