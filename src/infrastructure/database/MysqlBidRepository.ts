import { Pool } from "mysql2/promise";
import { Bid } from "../../domain/entities/Bid";
import { IBidRepository } from "../../domain/repositories/IBidRepository";

export class MysqlBidRepository implements IBidRepository {
  constructor(private readonly pool: Pool) {}

  async save(bid: Bid): Promise<void> {
    const toMysqlDate = (iso: string) => iso.slice(0, 19).replace('T', ' ');
    await this.pool.execute(
      `INSERT INTO bids (id, auction_id, user_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [bid.id, bid.auctionId, bid.userId, bid.amount, bid.status, toMysqlDate(bid.createdAt)]
    );
  }

async countAccepted(auctionId: string): Promise<number> {
  const [rows] = await this.pool.execute<any[]>(
    `SELECT COUNT(*) as count
     FROM bids
     WHERE status = 'accepted' AND auction_id = ?`,
    [auctionId]
  );

  return rows[0].count;
}

  async findAcceptedByAuction(auctionId: string): Promise<{ bidId: string; userId: string; nickname: string; avatarUrl: string | null; amount: number; createdAt: string }[]> {
    const [rows] = await this.pool.execute<any[]>(
        `SELECT b.id AS bidId, b.user_id AS userId, p.nickname, p.avatar_url AS avatarUrl,
                b.amount, b.created_at AS createdAt
         FROM bids b
         JOIN participants p ON p.id = b.user_id
         WHERE b.auction_id = ? AND b.status = 'accepted'
         ORDER BY b.amount DESC`,
        [auctionId]
    );
    return rows;
}

  async countAcceptedByAuction(auctionId: string): Promise<number> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT COUNT(*) AS total FROM bids WHERE status = 'accepted' AND auction_id = ?`,
      [auctionId]
    );
    return (rows[0] as { total: number }).total;
  }
}