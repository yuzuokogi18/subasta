import { WebSocketServer, WebSocket } from "ws";
import { JoinAuctionUseCase } from "../../application/use-cases/JoinAuctionUseCase";
import { PlaceBidUseCase } from "../../application/use-cases/PlaceBidUseCase";
import { CloseAuctionUseCase } from "../../application/use-cases/CloseAuctionUseCase";
import { DisconnectParticipantUseCase } from "../../application/use-cases/DisconnectParticipantUseCase";
import { AuctionDomainService } from "../../domain/services/AuctionDomainService";
import { MysqlAuctionRepository, Auction } from "../database/MysqlAuctionRepository";
import { MysqlBidRepository } from "../database/MysqlBidRepository";
import { MysqlAuctionResultRepository } from "../database/MysqlAuctionResultRepository";
import { MysqlParticipantRepository } from "../database/MysqlParticipantRepository";
import { ServerEvent } from "../../application/dtos/AuctionDtos";
import { ValidationError } from "../../shared/errors/AppErrors";
import { Pool } from "mysql2/promise";
import { parse } from "path";

// ── Sesión por cliente ─────────────────────────────────────────
interface ClientSession {
  userId:    string;
  nickname:  string;
  auctionId: string;   // ← cada cliente sabe a qué subasta pertenece
  avatarUrl?: string;
}

// ── Estado de una subasta en memoria ──────────────────────────
interface AuctionRoom {
  service:        AuctionDomainService;
  timer:          ReturnType<typeof setInterval> | null;
  placeBidUseCase: PlaceBidUseCase;
  closeUseCase:   CloseAuctionUseCase;
  clients:        Set<WebSocket>;   // clientes en esta subasta
}

export class AuctionWebSocketServer {
  private readonly wss: WebSocketServer;
  private readonly sessions = new Map<WebSocket, ClientSession>();
  private readonly rooms    = new Map<string, AuctionRoom>();  // auctionId → room

  constructor(
    port:                              number,
    private readonly joinUseCase:      JoinAuctionUseCase,
    private readonly disconnectUseCase: DisconnectParticipantUseCase,
    private readonly auctionRepo:      MysqlAuctionRepository,
    private readonly pool:             Pool   // para crear use cases por subasta
  ) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    console.log(`🚀 WebSocket server running on ws://localhost:${port}`);
  }

  private handleConnection(ws: WebSocket): void {
    console.log("🔌 New client connected");
    ws.on("message", (raw) => this.handleMessage(ws, raw.toString()));
    ws.on("close",   () => this.handleDisconnect(ws));
    ws.on("error",   (err) => console.error("WS error:", err.message));
  }

  private handleMessage(ws: WebSocket, raw: string): void {
    console.log("📨 Message received:", raw);
    let msg: { type: string; [key: string]: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      return this.sendTo(ws, { type: "error", data: { message: "Invalid JSON" } });
    }

    switch (msg.type) {
      case "join":
        this.handleJoin(ws, msg as any).catch(console.error);
        break;
      case "place_bid":
        this.handleBid(ws, msg as any).catch(console.error);
        break;
      default:
        this.sendTo(ws, { type: "error", data: { message: `Unknown event: ${msg.type}` } });
    }
  }

private async handleDisconnect(ws: WebSocket): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;

    this.sessions.delete(ws);

    const room = this.rooms.get(session.auctionId);
    if (room) {
        room.clients.delete(ws);
        const totalConnected = room.clients.size;
        const event = await this.disconnectUseCase.execute(
            session.userId,
            totalConnected,
            session.auctionId   // ← agregar
        );
        console.log(`❌ ${session.nickname} left auction ${session.auctionId}`);
        this.broadcastToRoom(session.auctionId, event);
    }
}

private async handleJoin(ws: WebSocket, msg: { userId: string; nickname: string; avatarUrl?: string; auctionId: string }): Promise<void> {
    try {
      if (!msg.userId || !msg.nickname || !msg.auctionId) {
        throw new ValidationError("userId, nickname and auctionId are required");
      }

      const auction = await this.auctionRepo.findById(msg.auctionId);
      if (!auction) {
        return this.sendTo(ws, { type: "error", data: { message: `Auction ${msg.auctionId} not found` } });
      }

      // No permitir unirse a subastas cerradas
      if (auction.status === "closed") {
        return this.sendTo(ws, { type: "error", data: { message: "Auction is already closed" } });
      }

      // Obtener o crear room
      let room = this.rooms.get(msg.auctionId);
      if (!room) {
        room = this.createRoom(msg.auctionId);
        this.rooms.set(msg.auctionId, room);

        // Si la subasta ya estaba activa (server reinició), restaurar estado desde BD
        if (auction.status === "active") {
          const lastBid = await this.auctionRepo.findLastBid(msg.auctionId);
          room.service.start(
            auction.id,
            auction.productName,
            auction.lotNumber,
            auction.productImageUrl,
            lastBid ? lastBid.amount : auction.startingPrice,
            auction.durationSeconds  // timeRemaining real no lo sabemos, usamos duration
          );
          if (lastBid) {
            room.service.applyBid(lastBid.userId, lastBid.nickname, lastBid.amount);
            console.log("🔍 currentState after restore:", JSON.stringify(room.service.getState()));
          }
          // Arrancar timer para continuar la subasta
          this.startTimer(msg.auctionId, room);
        }
      }

      const totalConnected = room.clients.size + 1;
      const result = await this.joinUseCase.execute(
        { userId: msg.userId, nickname: msg.nickname, avatarUrl: msg.avatarUrl, auctionId: msg.auctionId },
        totalConnected,
        auction
      );

      this.sessions.set(ws, { userId: msg.userId, nickname: msg.nickname, auctionId: msg.auctionId, avatarUrl: msg.avatarUrl });
      room.clients.add(ws);
      console.log(`✅ ${msg.nickname} joined auction ${msg.auctionId}`);

      // Enviar estado ACTUAL (con precio real si ya está activa)
      const currentState = room.service.getState();
      this.sendTo(ws, {
        type: "auction_state",
        data: {
          auctionId:       auction.id,
          product:         auction.productName,
          lotNumber:       auction.lotNumber,
          productImageUrl: auction.productImageUrl,
          currentPrice: parseFloat(currentState.currentPrice as any) || parseFloat(auction.startingPrice as any),
          leaderId:        currentState.leaderId,
          leaderNickname:  currentState.leaderNickname,
          timeRemaining:   currentState.timeRemaining,
          isActive:        currentState.isActive,
        },
      });
      this.broadcastToRoom(msg.auctionId, result.broadcastEvent);

      // Arrancar solo si status es waiting
      if (auction.status === "waiting") {
        this.startAuction(msg.auctionId, auction, room);
      }
    } catch (err) {
      console.error("❌ handleJoin error:", err);
      const message = err instanceof ValidationError ? err.message : "Join failed";
      this.sendTo(ws, { type: "error", data: { message } });
    }
  }

  // ── Timer separado para restaurar subastas activas ─────────
  private startTimer(auctionId: string, room: AuctionRoom): void {
    if (room.timer) return; // ya tiene timer
    room.timer = setInterval(async () => {
      room.service.decrementTimer();
      const current = room.service.getState();

      if (room.service.shouldBroadcastTick()) {
        this.broadcastToRoom(auctionId, {
          type: "timer_tick",
          data: { auctionId, timeRemaining: current.timeRemaining }
        });
      }

      if (room.service.isTimeUp()) {
        clearInterval(room.timer!);
        room.timer = null;
        try {
          const closedEvent = await room.closeUseCase.execute();
          this.auctionRepo.updateStatus(auctionId, "closed").catch(console.error);
          this.broadcastToRoom(auctionId, closedEvent);
          this.rooms.delete(auctionId);
        } catch (err) {
          console.error("Error closing auction:", err);
        }
      }
    }, 1000);
  }
private async handleBid(ws: WebSocket, msg: { amount: number; auctionId: string }): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return this.sendTo(ws, { type: "error", data: { message: "Not authenticated" } });

    const room = this.rooms.get(session.auctionId);
    if (!room) return this.sendTo(ws, { type: "error", data: { message: "Auction room not found" } });

    try {
      const state = room.service.getState();
      console.log("🔍 bid state:", JSON.stringify(state));
      
      const result = await room.placeBidUseCase.execute(
        { amount: msg.amount, auctionId: session.auctionId },
        session.userId,
        session.nickname,
        session.avatarUrl || ""
      );
      console.log("🔍 bid result:", JSON.stringify(result));

      if (result.accepted && result.broadcastEvent) {
        console.log(`💰 Bid accepted: ${session.nickname} -> $${msg.amount} on auction ${session.auctionId}`);
        this.broadcastToRoom(session.auctionId, result.broadcastEvent);
      } else if (result.rejectEvent) {
        console.log("❌ Bid rejected:", JSON.stringify(result.rejectEvent));
        this.sendTo(ws, result.rejectEvent);
      }
    } catch (err) {
      console.error("❌ handleBid error:", err);
      this.sendTo(ws, { type: "error", data: { message: "Bid failed" } });
    }
}

  // ── Crea use cases independientes por subasta ──────────────
  private createRoom(auctionId: string): AuctionRoom {
    const { MysqlBidRepository } = require("../database/MysqlBidRepository");
    const { MysqlAuctionResultRepository } = require("../database/MysqlAuctionResultRepository");
    const { MysqlParticipantRepository } = require("../database/MysqlParticipantRepository");
    const { PlaceBidUseCase } = require("../../application/use-cases/PlaceBidUseCase");
    const { CloseAuctionUseCase } = require("../../application/use-cases/CloseAuctionUseCase");

    const service           = new AuctionDomainService();
    const bidRepo           = new MysqlBidRepository(this.pool);
    const auctionResultRepo = new MysqlAuctionResultRepository(this.pool);
    const participantRepo   = new MysqlParticipantRepository(this.pool);
    const placeBidUseCase   = new PlaceBidUseCase(bidRepo, service);
    const closeUseCase      = new CloseAuctionUseCase(auctionResultRepo, bidRepo, participantRepo, service);

    return { service, timer: null, placeBidUseCase, closeUseCase, clients: new Set() };
  }

  private startAuction(auctionId: string, auction: Auction, room: AuctionRoom): void {
    room.service.start(
      auction.id,
      auction.productName,
      auction.lotNumber,
      auction.productImageUrl,
      parseFloat(auction.startingPrice as any),
      auction.durationSeconds
    );

    // Actualizar status en BD
    this.auctionRepo.updateStatus(auctionId, "active").catch(console.error);
    console.log(`🏁 Auction started: ${auction.productName} (${auctionId})`);

    const state = room.service.getState();
    this.broadcastToRoom(auctionId, {
      type: "auction_started",
      data: {
        auctionId:       state.auctionId,
        product:         state.productName  ?? "",
        lotNumber:       state.lotNumber    ?? "",
        startingPrice:   parseFloat(state.currentPrice as any),
        durationSeconds: state.timeRemaining,
      },
    });

    room.timer = setInterval(async () => {
      room.service.decrementTimer();
      const current = room.service.getState();

      if (room.service.shouldBroadcastTick()) {
        this.broadcastToRoom(auctionId, {
          type: "timer_tick",
          data: { auctionId, timeRemaining: current.timeRemaining }
        });
      }

      if (room.service.isTimeUp()) {
        clearInterval(room.timer!);
        room.timer = null;
        try {
          const closedEvent = await room.closeUseCase.execute();
          console.log(`🏆 Auction ${auctionId} closed - Winner: ${closedEvent.data.winnerNickname}`);
          this.auctionRepo.updateStatus(auctionId, "closed").catch(console.error);
          this.broadcastToRoom(auctionId, closedEvent);
          this.rooms.delete(auctionId);  // limpiar room
        } catch (err) {
          console.error("Error closing auction:", err);
        }
      }
    }, 1000);
  }

  // ── Broadcast solo a clientes de una subasta ───────────────
  private broadcastToRoom(auctionId: string, event: ServerEvent): void {
    const room = this.rooms.get(auctionId);
    if (!room) return;
    const msg = JSON.stringify(event);
    room.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
  }

  private sendTo(ws: WebSocket, event: ServerEvent): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }
}