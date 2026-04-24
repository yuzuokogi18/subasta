import { Participant } from "../entities/Participant";

export interface ParticipantWithStats extends Participant {
  bidCount: number;
  lastBidAt: string | null;
}

export interface IParticipantRepository {
  upsert(participant: Participant): Promise<void>;
  disconnect(id: string): Promise<void>;
  updateAvatarUrl(id: string, avatarUrl: string): Promise<void>;
  findAll(): Promise<ParticipantWithStats[]>;
  count(auctionId: string): Promise<number>;
}
