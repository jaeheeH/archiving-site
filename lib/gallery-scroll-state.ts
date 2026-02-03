/**
 * 갤러리 목록 상태 저장/복원 유틸리티
 * - 미드저니 스타일: 상세→목록 이동 시 스크롤 위치 & 필터 상태 복원
 */

const STORAGE_KEY = 'gallery_list_state';

export interface GalleryListState {
  scrollY: number;
  page: number;
  search: string;
  tags: string[];
  timestamp: number; // 상태 유효성 검증용
}

/**
 * 갤러리 목록 상태 저장
 * - 상세 페이지로 이동하기 전에 호출
 */
export function saveGalleryState(state: Omit<GalleryListState, 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  
  const stateWithTimestamp: GalleryListState = {
    ...state,
    timestamp: Date.now(),
  };
  
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp));
  } catch (error) {
    console.error('Failed to save gallery state:', error);
  }
}

/**
 * 갤러리 목록 상태 복원
 * - 목록 페이지 진입 시 호출
 * - 5분 이내의 상태만 유효하게 처리
 */
export function getGalleryState(): GalleryListState | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const state: GalleryListState = JSON.parse(saved);
    
    // 5분(300000ms) 이내의 상태만 유효
    const isValid = Date.now() - state.timestamp < 300000;
    if (!isValid) {
      clearGalleryState();
      return null;
    }
    
    return state;
  } catch (error) {
    console.error('Failed to get gallery state:', error);
    return null;
  }
}

/**
 * 저장된 상태 삭제
 * - 상태 복원 후 호출하여 중복 복원 방지
 */
export function clearGalleryState(): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear gallery state:', error);
  }
}

/**
 * 스크롤 복원 플래그 설정
 * - 상세 페이지에서 목록으로 돌아갈 때 설정
 */
export function setShouldRestoreScroll(value: boolean): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (value) {
      sessionStorage.setItem('gallery_should_restore', 'true');
    } else {
      sessionStorage.removeItem('gallery_should_restore');
    }
  } catch (error) {
    console.error('Failed to set restore flag:', error);
  }
}

/**
 * 스크롤 복원 플래그 확인 및 소비
 * - 확인 후 자동으로 플래그 삭제
 */
export function consumeShouldRestoreScroll(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const should = sessionStorage.getItem('gallery_should_restore') === 'true';
    if (should) {
      sessionStorage.removeItem('gallery_should_restore');
    }
    return should;
  } catch (error) {
    console.error('Failed to consume restore flag:', error);
    return false;
  }
}