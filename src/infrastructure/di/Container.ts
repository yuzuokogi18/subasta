import { getDatabase } from "../database/DatabaseConnection";
import { MysqlParticipantRepository } from "../database/MysqlParticipantRepository";
import { MysqlBidRepository } from "../database/MysqlBidRepository";
import { MysqlAuctionResultRepository } from "../database/MysqlAuctionResultRepository";
import { MysqlAuctionRepository } from "../database/MysqlAuctionRepository";
import { AuctionDomainService } from "../../domain/services/AuctionDomainService";
import { JoinAuctionUseCase } from "../../application/use-cases/JoinAuctionUseCase";
import { DisconnectParticipantUseCase } from "../../application/use-cases/DisconnectParticipantUseCase";
import { GetParticipantsUseCase } from "../../application/use-cases/GetParticipantsUseCase";
import { UploadAvatarUseCase } from "../../application/use-cases/UploadAvatarUseCase";
import { CloudinaryService } from "../cloudinary/CloudinaryService";
import { AuctionWebSocketServer } from "../websocket/AuctionWebSocketServer";
import { HttpApiServer } from "../http/HttpApiServer";

export function bootstrap(): void {
  const pool              = getDatabase();
  const participantRepo   = new MysqlParticipantRepository(pool);
  const auctionResultRepo = new MysqlAuctionResultRepository(pool);
  const auctionRepo       = new MysqlAuctionRepository(pool);
  const cloudinaryService = new CloudinaryService();

  // Use cases compartidos (no dependen de subasta específica)
  const auctionDomainService = new AuctionDomainService();
  const joinUseCase       = new JoinAuctionUseCase(participantRepo, auctionDomainService);
  const disconnectUseCase = new DisconnectParticipantUseCase(participantRepo);
  const getParticipants   = new GetParticipantsUseCase(participantRepo);
  const uploadAvatar      = new UploadAvatarUseCase(cloudinaryService, participantRepo);
  const bidRepo           = new MysqlBidRepository(pool);
  // WS server recibe el pool para crear rooms dinámicamente
  new AuctionWebSocketServer(8080, joinUseCase, disconnectUseCase, auctionRepo, pool);

  // HTTP server sin auctionDomainService global (ya no hay uno solo)
  new HttpApiServer(3000, getParticipants, uploadAvatar, auctionDomainService, auctionResultRepo, auctionRepo, cloudinaryService, bidRepo, participantRepo);
}