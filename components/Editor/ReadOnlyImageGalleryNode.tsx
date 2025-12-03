// components/Editor/ReadOnlyImageGalleryNode.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import type { NodeViewProps } from '@tiptap/react';

interface ImageGalleryAttrs {
  images: string[];
  layout: 'grid' | 'swiper';
}

type ReadOnlyImageGalleryComponentProps = NodeViewProps;

interface ImageInfo {
  url: string;
  widthPercent: number; // 최종 계산된 너비 퍼센트 (grid용)
}

const ReadOnlyImageGalleryComponent = ({
  node,
}: ReadOnlyImageGalleryComponentProps) => {
  const { images = [], layout = 'grid' } = node.attrs as ImageGalleryAttrs;
  
  const [imageInfos, setImageInfos] = useState<ImageInfo[]>(
    images.map(url => ({ url, widthPercent: 0 }))
  );

  const GAP_PIXELS = 16;
  const ROW_HEIGHT = 400; 

  useEffect(() => {
    if (images.length === 0) return;

    const calculateRatios = async () => {
      const ratios: number[] = await Promise.all(
        images.map(url => {
          return new Promise<number>((resolve) => {
            const img = new window.Image();
            img.onload = () => {
              resolve(img.naturalWidth / img.naturalHeight);
            };
            img.onerror = () => resolve(0);
            img.src = url;
          });
        })
      );

      const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);

      const newImageInfos = images.map((url, index) => {
        const ratio = ratios[index];
        const percent = totalRatio > 0 ? (ratio / totalRatio) * 100 : 0;
        return { url, widthPercent: percent };
      });

      setImageInfos(newImageInfos);
    };

    calculateRatios();
  }, [images]);

  if (images.length === 0) {
    return null;
  }

  const totalGapPixels = GAP_PIXELS * (images.length - 1);


  return (
    <NodeViewWrapper className="image-gallery-readonly">
      <div className="my-8">
        {layout === 'grid' ? (
          // GRID 레이아웃 (이전 답변 코드)
          <div className={`flex gap-4 w-full h-[${ROW_HEIGHT}px]`}> 
            
            {imageInfos.map((info, index) => {
              const fraction = info.widthPercent / 100;
              const calcWidth = `calc((100% - ${totalGapPixels}px) * ${fraction})`;

              return (
                <div 
                  key={info.url} 
                  style={{ width: calcWidth }} 
                  className="rounded-lg overflow-hidden flex-shrink-0" 
                >
                  <img
                    src={info.url}
                    alt={`이미지 ${index + 1}`}
                    className="w-full h-full object-contain" 
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // SWIPER 레이아웃 (수정된 부분)
          <div className="max-w-4xl mx-auto">
            <Swiper
              modules={[Navigation, Pagination]}
              navigation
              pagination={{ clickable: true }}
              className="rounded-lg h-[500px]" // Swiper 컨테이너의 높이 고정 (예: 500px)
              spaceBetween={20}
              // 👈 1. 핵심: slidesPerView를 'auto'로 설정하여 각 슬라이드가 콘텐츠 너비에 맞게 조절되도록 함
              slidesPerView={'auto'} 
              // 2. 중앙 정렬로 다음/이전 슬라이드 보이게 유지
              centeredSlides={false} 
            >
              {images.map((url: string, index: number) => (
                // 3. SwiperSlide에도 w-auto를 적용하여 콘텐츠 너비만큼만 차지하도록 함
                <SwiperSlide key={index} className="w-auto" style={{width:"auto!important"}}> 
                  {/* 4. 래퍼 div에 h-full과 w-auto 적용 */}
                  <div className="bg-black rounded-lg overflow-hidden h-full w-auto"> 
                    <img
                      src={url}
                      alt={`이미지 ${index + 1}`}
                      // 5. 이미지: 높이 꽉 채우고(h-full), 너비는 비율에 따라 자동 결정(w-auto), 잘림 방지(object-contain)
                      className="h-full w-auto object-contain" 
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        )}
      </div>
      <style jsx global>{`
        .swiper-wrapper .swiper-slide {
            width: auto !important; /* 비율 기반 너비 설정을 강제 적용 */
        }

        .swiper-wrapper .swiper-slide > div > img{ width:100%; height:100%; margin: 0 0 0 0 }
      `}</style>

    </NodeViewWrapper>
  );
};

export const ReadOnlyImageGalleryNode = Node.create({
  name: 'imageGallery',

  group: 'block',

  atom: true,

  draggable: false,

  addAttributes() {
    return {
      images: {
        default: [],
      },
      layout: {
        default: 'grid',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-gallery"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'image-gallery' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReadOnlyImageGalleryComponent);
  },
});