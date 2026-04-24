// ── Inbound DTOs (client → server) ──────────────────────────────────────────

export interface JoinDto {
  userId:    string;
  nickname:  string;
  avatarUrl?: string;
  auctionId: string;   // ← NUEVO: cliente especifica a qué subasta se une
}

export interface PlaceBidDto {
  amount:    number;
  auctionId: string;   // ← NUEVO
}

// ── Outbound DTOs (server → client) ─────────────────────────────────────────

export interface AuctionStateDto {
  type: "auction_state";
  data: {
    auctionId:       string;
    product:         string;
    lotNumber:       string;
    productImageUrl: string | null;
    currentPrice:    number;
    leaderId:        string | null;
    leaderNickname:  string | null;
    timeRemaining:   number;
    isActive:        boolean;
  };
}

export interface AuctionStartedDto {
  type: "auction_started";
  data: {
    auctionId:       string | null;
    product:         string;
    lotNumber:       string;
    startingPrice:   number;
    durationSeconds: number;
  };
}

export interface BidAcceptedDto {
  type: "bid_accepted";
  data: {
    auctionId:     string;   // ← NUEVO
    bidId:         string;
    userId:        string;
    nickname:      string;
    avatarUrl:     string | null;
    newPrice:      number;
    timeRemaining: number;
    extended:      boolean;
  };
}

export interface BidRejectedDto {
  type: "bid_rejected";
  data: { auctionId: string; reason: string; currentPrice: number };  // ← auctionId
}

export interface TimerTickDto {
  type: "timer_tick";
  data: { auctionId: string; timeRemaining: number };  // ← auctionId
}

export interface AuctionClosedDto {
  type: "auction_closed";
  data: {
    auctionId:         string;   // ← NUEVO
    winnerId:          string | null;
    winnerNickname:    string | null;
    finalPrice:        number;
    product:           string;
    totalBids:         number;
    totalParticipants: number;
  };
}

export interface ParticipantJoinedDto {
  type: "participant_joined";
  data: { auctionId: string; userId: string; nickname: string; totalConnected: number };
}

export interface ParticipantLeftDto {
  type: "participant_left";
  data: { auctionId: string; userId: string; totalConnected: number };
}

export interface ErrorDto {
  type: "error";
  data: { message: string };
}

export type ServerEvent =
  | AuctionStateDto
  | AuctionStartedDto
  | BidAcceptedDto
  | BidRejectedDto
  | TimerTickDto
  | AuctionClosedDto
  | ParticipantJoinedDto
  | ParticipantLeftDto
  | ErrorDto;