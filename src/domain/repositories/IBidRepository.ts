import { Bid } from "../entities/Bid";

export interface IBidRepository {
  save(bid: Bid): Promise<void>;
  countAccepted(auctionId: string): Promise<number>;
}
