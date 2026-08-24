export type MainTabParamList = {
  Today: {
    showUndoToast?: boolean;
    undoPresenceId?: string;
    undoMemberId?: string;
    undoStatusText?: string;
  } | undefined;
  Group: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  JoinGroup: undefined;
  MainApp: undefined;
  CheckIn: undefined;
  Settings: undefined;
  MemberDetail: { memberId: string };
};
