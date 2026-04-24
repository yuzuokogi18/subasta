export interface AuctionResult {
  id:                string;
  auctionId:         string;      // ← campo nuevo
  winnerUserId:      string | null;
  finalPrice:        number;
  totalBids:         number;
  totalParticipants: number;
  startedAt:         string;
  endedAt:           string;
}

export function createAuctionResult(
  id:                string,
  auctionId:         string,      // ← parámetro nuevo
  winnerUserId:      string | null,
  finalPrice:        number,
  totalBids:         number,
  totalParticipants: number,
  startedAt:         string
): AuctionResult {
  return {
    id,
    auctionId,
    winnerUserId,
    finalPrice,
    totalBids,
    totalParticipants,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}