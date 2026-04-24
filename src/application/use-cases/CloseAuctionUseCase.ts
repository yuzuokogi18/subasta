import { v4 as uuidv4 } from "uuid";
import { createAuctionResult } from "../../domain/entities/AuctionResult";
import { IAuctionResultRepository } from "../../domain/repositories/IAuctionResultRepository";
import { IBidRepository } from "../../domain/repositories/IBidRepository";
import { IParticipantRepository } from "../../domain/repositories/IParticipantRepository";
import { AuctionDomainService } from "../../domain/services/AuctionDomainService";
import { AuctionClosedDto } from "../dtos/AuctionDtos";

export class CloseAuctionUseCase {
  constructor(
    private readonly auctionResultRepo: IAuctionResultRepository,
    private readonly bidRepo:           IBidRepository,
    private readonly participantRepo:   IParticipantRepository,
    private readonly auctionService:    AuctionDomainService
  ) {}
async execute(): Promise<AuctionClosedDto> {
  const state = this.auctionService.getState();

  if (!state.auctionId) {
    throw new Error("Auction ID missing when closing auction");
  }


  this.auctionService.close();

  // ✅ FILTRAR POR SUBASTA
  const totalBids = await this.bidRepo.countAccepted(state.auctionId);
  const totalParticipants = await this.participantRepo.count(state.auctionId);

  console.log("🏆 Winner before save:", state.leaderId, state.leaderNickname);

  await this.auctionResultRepo.save(
    createAuctionResult(
      uuidv4(),
      state.auctionId,
      state.leaderId ?? null, // 👈 importante
      state.currentPrice,
      totalBids,
      totalParticipants,
      state.startedAt!
    )
  );

  return {
    type: "auction_closed",
    data: {
      auctionId: state.auctionId,
      winnerId: state.leaderId ?? null,
      winnerNickname: state.leaderNickname ?? "No bids",
      finalPrice: state.currentPrice,
      product: state.productName ?? "",
      totalBids,
      totalParticipants,
    },
  };
}
}