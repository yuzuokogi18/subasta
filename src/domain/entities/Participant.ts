export interface Participant {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
  isActive: boolean;
}

export function createParticipant(
  id: string,
  nickname: string,
  avatarUrl: string | null = null
): Participant {
  return {
    id,
    nickname,
    avatarUrl,
    connectedAt: new Date().toISOString(),
    disconnectedAt: null,
    isActive: true,
  };
}
