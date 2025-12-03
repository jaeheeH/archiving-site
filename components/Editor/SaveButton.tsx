'use client';

interface SaveButtonProps {
  onSave: () => void;
  onPublish: () => void;
  loading: boolean;
}

export default function SaveButton({ onSave, onPublish, loading }: SaveButtonProps) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
      <button
        onClick={onSave}
        disabled={loading}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#666',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '저장 중...' : '임시저장'}
      </button>

      <button
        onClick={onPublish}
        disabled={loading}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '발행 중...' : '발행하기'}
      </button>
    </div>
  );
}