import { createParticipant } from "../../domain/entities/Participant";
import { IParticipantRepository } from "../../domain/repositories/IParticipantRepository";
import { AuctionDomainService } from "../../domain/services/AuctionDomainService";
import { JoinDto, AuctionStateDto, ParticipantJoinedDto } from "../dtos/AuctionDtos";
import { Auction } from "../../infrastructure/database/MysqlAuctionRepository";

export interface JoinAuctionResult {
  stateEvent:         AuctionStateDto;
  broadcastEvent:     ParticipantJoinedDto;
  shouldStartAuction: boolean;
  auction:            Auction | null;
}

export class JoinAuctionUseCase {
  constructor(
    private readonly participantRepo: IParticipantRepository,
    private readonly auctionService:  AuctionDomainService
  ) {}

  async execute(
    dto:            JoinDto,
    totalConnected: number,
    auction:        Auction | null
  ): Promise<JoinAuctionResult> {
    const participant = createParticipant(dto.userId, dto.nickname, dto.avatarUrl ?? null);
    await this.participantRepo.upsert(participant);

    const state = this.auctionService.getState();

    const stateEvent: AuctionStateDto = {
      type: "auction_state",
      data: {
        auctionId:       auction?.id ?? state.auctionId ?? "",
        product:         auction?.productName ?? state.productName ?? "Subasta en Vivo",
        lotNumber:       auction?.lotNumber ?? state.lotNumber ?? "0000",
        productImageUrl: auction?.productImageUrl ?? null,
        currentPrice:    state.currentPrice,
        leaderId:        state.leaderId,
        leaderNickname:  state.leaderNickname,
        timeRemaining:   state.timeRemaining,
        isActive:        state.isActive,
      },
    };

    const broadcastEvent: ParticipantJoinedDto = {
      type: "participant_joined",
      data: { auctionId: dto.auctionId, userId: dto.userId, nickname: dto.nickname, totalConnected },
    };

    return { stateEvent, broadcastEvent, shouldStartAuction: !state.isActive, auction };
  }
}