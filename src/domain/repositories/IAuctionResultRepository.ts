// IAuctionResultRepository.ts
import { AuctionResult } from "../entities/AuctionResult";

export interface AuctionResultWithDetails extends AuctionResult {
    winnerNickname:  string | null;
    winnerAvatarUrl: string | null;
    productName:     string | null;
    productImageUrl: string | null;
}

export interface IAuctionResultRepository {
    save(result: AuctionResult): Promise<void>;
    findLatest(): Promise<AuctionResult | null>;
    findByAuctionId(auctionId: string): Promise<AuctionResultWithDetails | null>;
}