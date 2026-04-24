import { IParticipantRepository } from "../../domain/repositories/IParticipantRepository";
import { ParticipantLeftDto } from "../dtos/AuctionDtos";

export class DisconnectParticipantUseCase {
  constructor(private readonly participantRepo: IParticipantRepository) {}

// DisconnectParticipantUseCase.ts
async execute(userId: string, totalConnected: number, auctionId: string): Promise<ParticipantLeftDto> {
    await this.participantRepo.disconnect(userId);
    return {
        type: "participant_left",
        data: { auctionId, userId, totalConnected },  // ← agregar auctionId
    };
}
}
