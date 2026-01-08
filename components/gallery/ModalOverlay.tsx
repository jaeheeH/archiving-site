'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function ModalOverlay({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
    // 스크롤 막기
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const onDismiss = () => {
    router.back(); // 뒤로가기를 하면 URL이 /gallery로 바뀌면서 모달이 닫힘
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <dialog 
        ref={dialogRef} 
        className="w-full max-w-5xl max-h-[90vh] bg-transparent p-0 m-0 backdrop:bg-transparent overflow-visible focus:outline-none"
        onClose={onDismiss}
      >
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex justify-end p-4 absolute top-0 right-0 z-10">
            <button onClick={onDismiss} className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
              <i className="ri-close-line text-2xl"></i>
            </button>
          </div>
          <div className="overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </div>
      </dialog>
    </div>
  );
}