// components/PostDetail.tsx

'use client';

import { useEffect } from 'react';

export default function PostDetail({ postId }: { postId: string }) {
  useEffect(() => {
    // LocalStorage에서 봤던 글 확인
    const viewedPosts = JSON.parse(
      localStorage.getItem('viewedPosts') || '[]'
    );

    if (!viewedPosts.includes(postId)) {
      // LocalStorage에 추가
      viewedPosts.push(postId);
      localStorage.setItem('viewedPosts', JSON.stringify(viewedPosts));

      // 서버에 기록
      fetch(`/api/posts/${postId}/view`, { method: 'POST' });
    }
  }, [postId]);

  return (
    <div>
      {/* 포스트 내용 */}
    </div>
  );
}