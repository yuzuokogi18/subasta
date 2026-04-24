import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
}

export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key:    process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
    });
    console.log("☁️  Cloudinary configured");
  }

  async uploadFromBuffer(
    buffer: Buffer,
    userId: string
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder:         "live-auction/avatars",
          public_id:      `avatar_${userId}`,
          overwrite:      true,                  // reemplaza si el user sube otra vez
          transformation: [
            { width: 200, height: 200, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(error ?? new Error("Upload failed"));
          }
          resolve({
            url:      result.secure_url,
            publicId: result.public_id,
            format:   result.format,
            width:    result.width,
            height:   result.height,
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  async uploadProductImage(buffer: Buffer, lotNumber: string): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:         "live-auction/products",
        public_id:      `product_lot_${lotNumber}`,
        overwrite:      true,
        transformation: [
          { width: 800, height: 600, crop: "fill" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id, format: result.format, width: result.width, height: result.height });
      }
    );
    uploadStream.end(buffer);
  });
}

  async deleteAvatar(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
