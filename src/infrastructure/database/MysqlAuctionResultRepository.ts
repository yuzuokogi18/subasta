import { Pool } from "mysql2/promise";
import { AuctionResult } from "../../domain/entities/AuctionResult";
import { AuctionResultWithDetails, IAuctionResultRepository } from "../../domain/repositories/IAuctionResultRepository";

export class MysqlAuctionResultRepository implements IAuctionResultRepository {
  constructor(private readonly pool: Pool) {}

async save(result: AuctionResult): Promise<void> {
    const toMysqlDate = (iso: string) => iso.slice(0, 19).replace('T', ' ');
    await this.pool.execute(
      `INSERT INTO auction_results
         (id, auction_id, winner_user_id, final_price, total_bids, total_participants, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        result.auctionId,
        result.winnerUserId,
        result.finalPrice,
        result.totalBids,
        result.totalParticipants,
        toMysqlDate(result.startedAt),
        toMysqlDate(result.endedAt),
      ]
    );
}

  async findLatest(): Promise<AuctionResult | null> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT
         id, auction_id AS auctionId, winner_user_id AS winnerUserId,
         final_price AS finalPrice, total_bids AS totalBids,
         total_participants AS totalParticipants, started_at AS startedAt,
         ended_at AS endedAt
       FROM auction_results
       ORDER BY ended_at DESC LIMIT 1`
    );
    return rows.length > 0 ? (rows[0] as AuctionResult) : null;
  }

async findByAuctionId(auctionId: string): Promise<AuctionResultWithDetails | null> {
    const [rows] = await this.pool.execute<any[]>(
        `SELECT 
            ar.id, ar.auction_id AS auctionId, ar.winner_user_id AS winnerUserId,
            p.nickname           AS winnerNickname,
            p.avatar_url         AS winnerAvatarUrl,
            ar.final_price       AS finalPrice, 
            ar.total_bids        AS totalBids,
            ar.total_participants AS totalParticipants,
            ar.started_at        AS startedAt, 
            ar.ended_at          AS endedAt,
            a.product_name       AS productName, 
            a.product_image_url  AS productImageUrl
         FROM auction_results ar
         LEFT JOIN participants p ON p.id = ar.winner_user_id
         LEFT JOIN auctions a ON a.id = ar.auction_id
         WHERE ar.auction_id = ?
         LIMIT 1`,
        [auctionId]
    );
    return rows.length > 0 ? rows[0] as AuctionResultWithDetails : null;
  }
}