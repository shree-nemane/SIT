export interface Presence {
  id: string;
  memberId: string;
  description: string;
  imageId?: string | null;
  updatedAt: string;
  syncStatus: 'draft' | 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface PresenceMemberInfo {
  memberId: string;
  displayName: string;
  profileImageId?: string | null;
  presence: Presence | null;
}
