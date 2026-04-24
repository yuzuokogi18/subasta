export interface AuctionState {
  auctionId:       string | null;
  productName:     string | null;
  lotNumber:       string | null;
  productImageUrl: string | null;
  currentPrice:    number;
  leaderId:        string | null;
  leaderNickname:  string | null;
  timeRemaining:   number;
  isActive:        boolean;
  startedAt:       string | null;
}

export const AUCTION_CONFIG = {
  BID_INCREMENT:             10,
  EXTEND_THRESHOLD_SECONDS:  30,
} as const;

export function createInitialAuctionState(): AuctionState {
  return {
    auctionId:       null,
    productName:     null,
    lotNumber:       null,
    productImageUrl: null,
    currentPrice:    0,
    leaderId:        null,
    leaderNickname:  null,
    timeRemaining:   0,
    isActive:        false,
    startedAt:       null,
  };
}