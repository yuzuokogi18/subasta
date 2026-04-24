import { IParticipantRepository, ParticipantWithStats } from "../../domain/repositories/IParticipantRepository";

export class GetParticipantsUseCase {
  constructor(private readonly participantRepo: IParticipantRepository) {}

  async execute(): Promise<ParticipantWithStats[]> {
    return this.participantRepo.findAll();
  }
}
