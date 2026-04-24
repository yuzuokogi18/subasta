import { CloudinaryService } from "../../infrastructure/cloudinary/CloudinaryService";
import { IParticipantRepository } from "../../domain/repositories/IParticipantRepository";
import { ValidationError } from "../../shared/errors/AppErrors";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp"];

export interface UploadAvatarDto {
  userId:    string;
  buffer:    Buffer;
  mimeType:  string;
  sizeBytes: number;
}

export interface UploadAvatarResult {
  avatarUrl: string;
  publicId:  string;
}

export class UploadAvatarUseCase {
  constructor(
    private readonly cloudinary:      CloudinaryService,
    private readonly participantRepo: IParticipantRepository
  ) {}

  async execute(dto: UploadAvatarDto): Promise<UploadAvatarResult> {
    if (!ALLOWED_TYPES.includes(dto.mimeType)) {
      throw new ValidationError(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`);
    }
    if (dto.sizeBytes > MAX_SIZE_BYTES) {
      throw new ValidationError("File too large. Max size is 5MB");
    }

    const result = await this.cloudinary.uploadFromBuffer(dto.buffer, dto.userId);
    await this.participantRepo.updateAvatarUrl(dto.userId, result.url);

    return { avatarUrl: result.url, publicId: result.publicId };
  }
}
