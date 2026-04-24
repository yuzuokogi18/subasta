import { v4 as uuidv4 } from "uuid";
import { createBid } from "../../domain/entities/Bid";
import { IBidRepository } from "../../domain/repositories/IBidRepository";
import { AuctionDomainService } from "../../domain/services/AuctionDomainService";
import { PlaceBidDto, BidAcceptedDto, BidRejectedDto } from "../dtos/AuctionDtos";

export interface PlaceBidResult {
  accepted:        boolean;
  broadcastEvent?: BidAcceptedDto;
  rejectEvent?:    BidRejectedDto;
}

export class PlaceBidUseCase {
  constructor(
    private readonly bidRepo:        IBidRepository,
    private readonly auctionService: AuctionDomainService
  ) {}

  async execute(dto: PlaceBidDto, userId: string, nickname: string, avatarUrl: string): Promise<PlaceBidResult> {
    const validation = this.auctionService.validateBid(dto.amount);
    const state      = this.auctionService.getState();

    if (!validation.valid) {
      await this.bidRepo.save(createBid(uuidv4(), state.auctionId!, userId, dto.amount, "rejected"));
      return {
        accepted: false,
        rejectEvent: {
          type: "bid_rejected",
          data: { auctionId: dto.auctionId, reason: validation.reason!, currentPrice: state.currentPrice },
        },
      };
    }

    const bid = createBid(uuidv4(), state.auctionId!, userId, dto.amount, "accepted");
    await this.bidRepo.save(bid);
    this.auctionService.applyBid(userId, nickname, dto.amount);

    const extended = this.auctionService.extendTimerIfNeeded();
    const newState = this.auctionService.getState();

    return {
      accepted: true,
      broadcastEvent: {
        type: "bid_accepted",
        data: {
          auctionId:     dto.auctionId,
          bidId:         bid.id,
          userId,
          nickname,
          avatarUrl: avatarUrl ?? null,
          newPrice:      dto.amount,
          timeRemaining: newState.timeRemaining,
          extended,
        },
      },
    };
  }
}