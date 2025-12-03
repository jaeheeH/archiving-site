// components/Editor/ImageGrid.tsx

'use client';

interface ImageGridProps {
  images: string[];
  onRemove: (index: number) => void;
}

export default function ImageGrid({ images, onRemove }: ImageGridProps) {
  if (images.length === 0) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          color: '#999',
        }}
      >
        이미지를 추가하세요
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '10px',
      }}
    >
      {images.map((url, index) => (
        <div
          key={index}
          style={{
            position: 'relative',
            paddingBottom: '100%',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#f0f0f0',
          }}
        >
          <img
            src={url}
            alt={`Image ${index + 1}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <button
            onClick={() => onRemove(index)}
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}