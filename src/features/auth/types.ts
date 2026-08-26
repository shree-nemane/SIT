export type AuthStatus = 'signed_out' | 'signed_in';
export type MembershipStatus = 'no_group' | 'member';

export interface UserMember {
  id: string;
  groupId: string;
  displayName: string;
  profileImageId?: string | null;
  profileImageLocalPath?: string | null;
  joinedAt: string;
}

export interface AuthState {
  authStatus: AuthStatus;
  membershipStatus: MembershipStatus;
  userEmail: string | null;
  member: UserMember | null;
  isLoading: boolean;
  error: string | null;
}
