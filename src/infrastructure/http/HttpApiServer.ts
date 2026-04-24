import http, { IncomingMessage, ServerResponse } from "http";
import { v4 as uuidv4 } from "uuid";
import { GetParticipantsUseCase } from "../../application/use-cases/GetParticipantsUseCase";
import { UploadAvatarUseCase } from "../../application/use-cases/UploadAvatarUseCase";
import { AuctionDomainService } from "../../domain/services/AuctionDomainService";
import { IAuctionResultRepository } from "../../domain/repositories/IAuctionResultRepository";
import { MysqlAuctionRepository } from "../database/MysqlAuctionRepository";
import { CloudinaryService } from "../cloudinary/CloudinaryService";
import { ValidationError } from "../../shared/errors/AppErrors";
import { MysqlBidRepository } from "../database/MysqlBidRepository";
import { MysqlParticipantRepository } from "../database/MysqlParticipantRepository";

export class HttpApiServer {

  private toMySQLDate(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  private readonly server: http.Server;

  constructor(
    port: number,
    private readonly getParticipantsUseCase: GetParticipantsUseCase,
    private readonly uploadAvatarUseCase:     UploadAvatarUseCase,
    private readonly auctionService:          AuctionDomainService,
    private readonly auctionResultRepo:       IAuctionResultRepository,
    private readonly auctionRepo:             MysqlAuctionRepository,
    private readonly cloudinaryService:       CloudinaryService,
    private readonly bidRepo:                 MysqlBidRepository,
    private readonly participantRepo:         MysqlParticipantRepository
  ) {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(port, () => {
      console.log(`🌐 HTTP API running on http://localhost:${port}`);
    });
  }


  

private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url?.split("?")[0] ?? "";
  const route = `${req.method} ${url}`;

  try {

    // ─────────────────────────────────────────────
    // ✅ RUTAS ESPECÍFICAS PRIMERO
    // ─────────────────────────────────────────────

    if (route === "GET /participants") {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: await this.getParticipantsUseCase.execute()
      }));
      return;
    }

    if (route === "GET /state") {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: this.auctionService.getState()
      }));
      return;
    }

    if (route === "GET /result") {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: await this.auctionResultRepo.findLatest()
      }));
      return;
    }

    if (route === "GET /auctions") {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: await this.auctionRepo.findAll()
      }));
      return;
    }

    if (route === "GET /auctions/active") {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: await this.auctionRepo.findActive()
      }));
      return;
    }

    if (route === "POST /auctions") {
      await this.handleCreateAuction(req, res);
      return;
    }

    if (route === "POST /avatar/upload") {
      await this.handleAvatarUpload(req, res);
      return;
    }

    const auctionBidsMatch = url.match(/^\/auctions\/([^/]+)\/bids$/);
if (req.method === "GET" && auctionBidsMatch) {
    const auctionId = auctionBidsMatch[1];
    const bids = await this.bidRepo.findAcceptedByAuction(auctionId);
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: bids }));
    return;
}

const auctionResultMatch = url.match(/^\/auctions\/([^/]+)\/result$/);
if (req.method === "GET" && auctionResultMatch) {
    const auctionId = auctionResultMatch[1];
    const result = await this.auctionResultRepo.findByAuctionId(auctionId);
    if (!result) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: "Result not found" }));
    } else {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: result }));
    }
    return;
  }

  const auctionParticipantsMatch = url.match(/^\/auctions\/([^/]+)\/participants$/);
if (req.method === "GET" && auctionParticipantsMatch) {
    const auctionId = auctionParticipantsMatch[1];
    const participants = await this.participantRepo.findByAuction(auctionId);
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: participants }));
    return;
}

    const auctionByIdMatch = url.match(/^\/auctions\/([^/]+)$/);

    if (req.method === "GET" && auctionByIdMatch) {
      const auctionId = auctionByIdMatch[1];

      const auction = await this.auctionRepo.findById(auctionId);

      if (!auction) {
        res.writeHead(404);
        res.end(JSON.stringify({
          success: false,
          error: "Auction not found"
        }));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: auction
        }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: "Route not found"
    }));

  } catch (err) {
    const isValidation = err instanceof ValidationError;

    res.writeHead(isValidation ? 400 : 500);
    res.end(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : "Internal server error"
    }));
  }
}

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handleCreateAuction(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const contentType = req.headers["content-type"] ?? "";
    if (contentType.includes("multipart/form-data")) {
      await this.handleCreateAuctionMultipart(req, res);
    } else {
      await this.handleCreateAuctionJson(req, res);
    }
  }

  

  // ── POST /auctions con imagen ──────────────────────────────────────────────
private async handleCreateAuctionMultipart(req: IncomingMessage, res: ServerResponse): Promise<void> {
    req.socket.setTimeout(120000);
    req.socket.setNoDelay(true);

    const busboy = (await import("busboy")).default;
    const bb = busboy({ 
        headers: req.headers, 
        limits: { fileSize: 20 * 1024 * 1024 }  // ← 20MB
    });

    let productName = "", lotNumber = "", mimeType = "", fileSize = 0;
    let startingPrice = 1000, durationSeconds = 120;
    let buffer: Buffer | null = null;

    bb.on("field", (name: string, value: string) => {
        if (name === "productName")     productName     = value;
        if (name === "lotNumber")       lotNumber       = value;
        if (name === "startingPrice")   startingPrice   = Number(value);
        if (name === "durationSeconds") durationSeconds = Number(value);
    });

    bb.on("file", (_: string, file: NodeJS.ReadableStream, info: { mimeType: string }) => {
        mimeType = info.mimeType;
        const chunks: Buffer[] = [];
        file.on("data", (chunk: Buffer) => { chunks.push(chunk); fileSize += chunk.length; });
        file.on("end", () => { buffer = Buffer.concat(chunks); });
    });

    bb.on("finish", async () => {
        try {
            if (!productName || !lotNumber) {
                throw new ValidationError("productName and lotNumber are required");
            }

            let productImageUrl: string | null = null;
            if (buffer) {
                const uploaded = await this.cloudinaryService.uploadProductImage(buffer, lotNumber);
                productImageUrl = uploaded.url;
            }

            const createdAt = this.toMySQLDate(new Date());

            const auction = {
                id:              uuidv4(),
                productName,
                lotNumber,
                productImageUrl,
                startingPrice,
                durationSeconds,
                status:          "waiting" as const,
                createdAt,
            };

            await this.auctionRepo.save(auction);
            console.log(`🏷️  New auction: ${productName} (Lot #${lotNumber}) image: ${productImageUrl ?? "none"}`);

            res.writeHead(201);
            res.end(JSON.stringify({ success: true, data: auction }));
        } catch (err) {
            res.writeHead(err instanceof ValidationError ? 400 : 500);
            res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Error" }));
        }
    });

    bb.on("error", (err: Error) => {
        console.error("Busboy error:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: "File upload error" }));
    });

    req.on("error", (err: Error) => {
        console.error("Request error:", err);
    });

    req.pipe(bb);
}

  // ── POST /auctions sin imagen (JSON) ───────────────────────────────────────
  private async handleCreateAuctionJson(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.parseBody(req);

    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
      return;
    }

    const { productName, lotNumber, startingPrice, durationSeconds } = parsed;

    if (!productName || !lotNumber) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: "productName and lotNumber are required" }));
      return;
    }

    const createdAt = this.toMySQLDate(new Date());

    const auction = {
      id:              uuidv4(),
      productName:     productName as string,
      lotNumber:       lotNumber as string,
      productImageUrl: null,
      startingPrice:   Number(startingPrice   ?? 1000),
      durationSeconds: Number(durationSeconds ?? 120),
      status:          "waiting" as const,
      createdAt:       createdAt,
    };

    await this.auctionRepo.save(auction);
    console.log(`🏷️  New auction: ${productName} (Lot #${lotNumber})`);

    res.writeHead(201);
    res.end(JSON.stringify({ success: true, data: auction }));
  }

  // ── POST /avatar/upload ────────────────────────────────────────────────────
  private async handleAvatarUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: "Expected multipart/form-data" }));
      return;
    }

    const busboy = (await import("busboy")).default;
    const bb = busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } });

    let userId = "", mimeType = "", fileSize = 0;
    let buffer: Buffer | null = null;

    bb.on("field", (name: string, value: string) => { if (name === "userId") userId = value; });
    bb.on("file", (_: string, file: NodeJS.ReadableStream, info: { mimeType: string }) => {
      mimeType = info.mimeType;
      const chunks: Buffer[] = [];
      file.on("data", (chunk: Buffer) => { chunks.push(chunk); fileSize += chunk.length; });
      file.on("end", () => { buffer = Buffer.concat(chunks); });
    });

    bb.on("finish", async () => {
      try {
        if (!userId) throw new ValidationError("userId field is required");
        if (!buffer) throw new ValidationError("avatar file is required");
        const result = await this.uploadAvatarUseCase.execute({ userId, buffer, mimeType, sizeBytes: fileSize });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: result }));
      } catch (err) {
        res.writeHead(err instanceof ValidationError ? 400 : 500);
        res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Upload failed" }));
      }
    });

    req.pipe(bb);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private parseBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString(); });
      req.on("end",  () => resolve(body));
    });
  }
}