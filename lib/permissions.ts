// lib/permissions.ts

/**
 * 블로그 글 권한 체크 함수
 *
 * 권한 규칙:
 * - editor: 작성한 글만 수정, 삭제 가능
 * - sub-admin: admin이 작성한 글 제외한 전체 글 수정, 삭제 가능
 * - admin: 전체 글 수정, 삭제 가능
 */

export interface PermissionCheck {
  currentUserId: string;
  currentUserRole: string;
  postAuthorId: string;
  authorRole?: string; // 글 작성자의 role (sub-admin이 admin 글 수정 불가 체크용)
}

/**
 * 글 수정 권한 체크
 */
export function canEditPost(params: PermissionCheck): boolean {
  const { currentUserId, currentUserRole, postAuthorId, authorRole } = params;

  // admin은 모든 글 수정 가능
  if (currentUserRole === 'admin') {
    return true;
  }

  // sub-admin은 admin이 작성한 글 제외하고 수정 가능
  if (currentUserRole === 'sub-admin') {
    // 작성자가 admin이면 수정 불가
    if (authorRole === 'admin') {
      return false;
    }
    return true;
  }

  // editor는 자기 글만 수정 가능
  if (currentUserRole === 'editor') {
    return currentUserId === postAuthorId;
  }

  // 그 외 role은 수정 불가
  return false;
}

/**
 * 글 삭제 권한 체크
 */
export function canDeletePost(params: PermissionCheck): boolean {
  // 삭제 권한은 수정 권한과 동일
  return canEditPost(params);
}
