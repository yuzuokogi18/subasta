export type BidStatus = "accepted" | "rejected";

export interface Bid {
  id:        string;
  auctionId: string;      // ← campo nuevo
  userId:    string;
  amount:    number;
  status:    BidStatus;
  createdAt: string;
}

export function createBid(
  id:        string,
  auctionId: string,      // ← parámetro nuevo
  userId:    string,
  amount:    number,
  status:    BidStatus
): Bid {
  return {
    id,
    auctionId,
    userId,
    amount,
    status,
    createdAt: new Date().toISOString(),
  };
}