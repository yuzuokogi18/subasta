import { Pool } from "mysql2/promise";
import { Participant } from "../../domain/entities/Participant";
import {
  IParticipantRepository,
  ParticipantWithStats,
} from "../../domain/repositories/IParticipantRepository";

export class MysqlParticipantRepository implements IParticipantRepository {
  constructor(private readonly pool: Pool) {}
async upsert(participant: Participant): Promise<void> {
    const connectedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await this.pool.execute(
      `INSERT INTO participants (id, nickname, avatar_url, connected_at, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         nickname        = VALUES(nickname),
         connected_at    = VALUES(connected_at),
         disconnected_at = NULL,
         is_active       = 1`,
      [participant.id, participant.nickname, participant.avatarUrl, connectedAt]
    );
}

  async disconnect(id: string): Promise<void> {
    await this.pool.execute(
      `UPDATE participants SET is_active = 0, disconnected_at = NOW() WHERE id = ?`,
      [id]
    );
  }

  async updateAvatarUrl(id: string, avatarUrl: string): Promise<void> {
    await this.pool.execute(
      `UPDATE participants SET avatar_url = ? WHERE id = ?`,
      [avatarUrl, id]
    );
  }

  async findAll(): Promise<ParticipantWithStats[]> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT
         p.id, p.nickname, p.avatar_url AS avatarUrl,
         p.connected_at AS connectedAt,
         p.disconnected_at AS disconnectedAt,
         p.is_active AS isActive,
         COUNT(b.id) AS bidCount,
         MAX(b.created_at) AS lastBidAt
       FROM participants p
       LEFT JOIN bids b ON b.user_id = p.id AND b.status = 'accepted'
       GROUP BY p.id, p.nickname, p.avatar_url, p.connected_at, p.disconnected_at, p.is_active
       ORDER BY bidCount DESC`
    );
    return rows as ParticipantWithStats[];
  }

  async findByAuction(auctionId: string): Promise<any[]> {
    const [rows] = await this.pool.execute<any[]>(
        `SELECT DISTINCT p.id, p.nickname, p.avatar_url AS avatarUrl,
                p.is_active AS isActive, p.connected_at AS connectedAt,
                COUNT(b.id) AS bidCount, MAX(b.created_at) AS lastBidAt
         FROM participants p
         JOIN bids b ON b.user_id = p.id AND b.auction_id = ?
         GROUP BY p.id, p.nickname, p.avatar_url, p.is_active, p.connected_at
         ORDER BY bidCount DESC`,
        [auctionId]
    );
    return rows;
}

  async count(auctionId: string): Promise<number> {
    const [rows] = await this.pool.execute<any[]>(
        `SELECT COUNT(DISTINCT b.user_id) as count
         FROM bids b
         WHERE b.auction_id = ? AND b.status = 'accepted'`,
        [auctionId]
    );
    return rows[0].count;
}
}
