// app/(dashboard)/dashboard/brands/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type TrainedModel = {
  status?: 'succeeded' | 'failed' | 'processing' | 'starting' | string;
};

type Brand = {
  id: string;
  name: string;
  trigger_word: string;
  created_at: string;
  trained_models?: TrainedModel[];
};

export default function MyBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 수정 모드 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '' }); // 이름만 수정 가능

  // 목록 불러오기
  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      const data = await res.json();
      if (Array.isArray(data)) {
        setBrands(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBrands();
  }, []);

  // 수정 시작
  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setEditForm({ name: brand.name });
  };

  // 수정 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '' });
  };

  // 수정 저장 (이름만 변경)
  const handleUpdate = async () => {
    if (!editForm.name) return alert('이름을 입력해주세요.');

    try {
      const res = await fetch('/api/brands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editForm.name }), // 이름만 전송
      });

      if (!res.ok) throw new Error('수정 실패');
      
      alert('수정되었습니다.');
      setEditingId(null);
      fetchBrands();
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  // 삭제 요청
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? \n연관된 모델과 이미지가 모두 삭제됩니다.')) return;

    try {
      const res = await fetch('/api/brands', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('삭제 실패');

      alert('삭제되었습니다.');
      setBrands(prev => prev.filter(b => b.id !== id));
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  // 상태 뱃지 컴포넌트
  const StatusBadge = ({ models }: { models?: TrainedModel[] }) => {
    const latestModel = models && models.length > 0 ? models[0] : null;
    const status = latestModel ? latestModel.status : 'pending';

    if (status === 'succeeded') {
      return <span className="px-2 py-1 text-[10px] font-bold text-green-700 bg-green-100 rounded-full border border-green-200">✅ 학습 완료</span>;
    } else if (status === 'failed') {
      return <span className="px-2 py-1 text-[10px] font-bold text-red-700 bg-red-100 rounded-full border border-red-200">❌ 학습 실패</span>;
    } else if (status === 'processing' || status === 'starting') {
      return <span className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-100 rounded-full animate-pulse border border-blue-200">🔄 학습 중...</span>;
    } else {
      return <span className="px-2 py-1 text-[10px] font-bold text-gray-700 bg-gray-100 rounded-full border border-gray-200">⏳ 대기 중</span>;
    }
  };

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-2xl font-bold">내 브랜드 관리</h1>
           <p className="text-sm text-gray-500 mt-1">등록된 브랜드와 학습 상태를 확인하세요.</p>
        </div>
        <Link href="/dashboard/brand-kit">
          <Button className="bg-black text-white hover:bg-gray-800">
            + 새 브랜드 만들기
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {brands.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 border-2 border-dashed rounded-lg">
            <p className="text-gray-500 mb-4">아직 등록된 브랜드가 없습니다.</p>
            <Link href="/dashboard/brand-kit" className="text-blue-600 hover:underline">
              첫 브랜드 만들러 가기 &rarr;
            </Link>
          </div>
        ) : (
          brands.map((brand) => (
            <div key={brand.id} className="bg-white border rounded-lg p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-gray-300 transition-colors">
              
              {editingId === brand.id ? (
                // [수정 모드 UI]
                <div className="flex-1 w-full space-y-4 bg-gray-50 p-4 rounded-md border border-indigo-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 font-bold mb-1 block">브랜드 이름 (수정 가능)</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editForm.name}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      />
                    </div>
                    
                    {/* 트리거 단어 (읽기 전용) */}
                    <div>
                      <label className="text-xs text-gray-400 font-bold mb-1 block">트리거 단어 (수정 불가)</label>
                      <div className="w-full p-2 border rounded bg-gray-200 text-gray-500 font-mono select-none cursor-not-allowed">
                        {brand.trigger_word}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        * 학습된 모델 연결 보호를 위해 수정할 수 없습니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button onClick={cancelEdit} variant="outline" className="h-8 text-xs bg-white">
                      취소
                    </Button>
                    <Button onClick={handleUpdate} className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs">
                      저장하기
                    </Button>
                  </div>
                </div>
              ) : (
                // [일반 보기 UI]
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{brand.name}</h3>
                    <StatusBadge models={brand.trained_models} />
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md border">
                        <span className="text-xs font-bold text-gray-400">TRIGGER ID</span>
                        <span className="font-mono text-indigo-600 font-bold tracking-wide">
                        {brand.trigger_word}
                        </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      | 생성일: {new Date(brand.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}

              {/* 버튼 그룹 (수정 모드가 아닐 때만 보임) */}
              {editingId !== brand.id && (
                <div className="flex items-center gap-2 self-end md:self-center">
                   {/* 바로 Studio로 이동하는 버튼 */}
                   <Link href={`/dashboard/studio?brand=${brand.id}`}>
                    <Button variant="outline" className="h-10 px-4 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 font-medium">
                      🎨 이미지 생성하기
                    </Button>
                  </Link>
                  
                  <div className="h-6 w-px bg-gray-200 mx-1"></div>

                  <Button onClick={() => startEdit(brand)} variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
                    수정
                  </Button>
                  
                  <Button onClick={() => handleDelete(brand.id)} variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50">
                    삭제
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
