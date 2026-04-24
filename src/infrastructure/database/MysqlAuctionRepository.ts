import { Pool } from "mysql2/promise";

export interface Auction {
  id:               string;
  productName:      string;
  lotNumber:        string;
  productImageUrl:  string | null;   // ← nueva
  startingPrice:    number;
  durationSeconds:  number;
  status:           "waiting" | "active" | "closed";
  createdAt:        string;
}

export class MysqlAuctionRepository {
  constructor(private readonly pool: Pool) {}

  async save(auction: Auction): Promise<void> {
    const toMysqlDate = (iso: string) => iso.slice(0, 19).replace('T', ' ');
    await this.pool.execute(
      `INSERT INTO auctions
         (id, product_name, lot_number, product_image_url, starting_price, duration_seconds, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auction.id,
        auction.productName,
        auction.lotNumber,
        auction.productImageUrl,
        auction.startingPrice,
        auction.durationSeconds,
        auction.status,
        toMysqlDate(auction.createdAt),
      ]
    );
  }

  async findAll(): Promise<Auction[]> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT
         id,
         product_name     AS productName,
         lot_number       AS lotNumber,
         product_image_url AS productImageUrl,
         starting_price   AS startingPrice,
         duration_seconds AS durationSeconds,
         status,
         created_at       AS createdAt
       FROM auctions
       ORDER BY created_at DESC`
    );
    return rows as Auction[];
  }

  async findActive(): Promise<Auction[]> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT
         id,
         product_name     AS productName,
         lot_number       AS lotNumber,
         product_image_url AS productImageUrl,
         starting_price   AS startingPrice,
         duration_seconds AS durationSeconds,
         status,
         created_at       AS createdAt
       FROM auctions
       WHERE status = 'active'
      `
    );
    return rows.length > 0 ? (rows as Auction[]) : []
  }

async findLastBid(auctionId: string): Promise<{ userId: string; nickname: string; amount: number } | null> {
    const [rows] = await this.pool.execute<any[]>(
        `SELECT b.user_id AS userId, p.nickname, b.amount
         FROM bids b
         JOIN participants p ON p.id = b.user_id
         WHERE b.auction_id = ? AND b.status = 'accepted'
         ORDER BY b.amount DESC
         LIMIT 1`,
        [auctionId]
    );
    if (rows.length === 0) return null;
    return {
        userId:   rows[0].userId,
        nickname: rows[0].nickname,
        amount:   parseFloat(rows[0].amount)  // ← agregar parseFloat
    };
}

  async findWaiting(): Promise<Auction | null> {
  const [rows] = await this.pool.execute<any[]>(
    `SELECT id, product_name AS productName, lot_number AS lotNumber,
            starting_price AS startingPrice, duration_seconds AS durationSeconds,
            product_image_url AS productImageUrl,
            status, created_at AS createdAt
     FROM auctions WHERE status = 'waiting'
     ORDER BY created_at ASC LIMIT 1`
  );
  return rows.length > 0 ? (rows[0] as Auction) : null;
}

  // ── NUEVO: buscar subasta por ID ─────────────────────────────
  async findById(id: string): Promise<Auction | null> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT
         id,
         product_name     AS productName,
         lot_number       AS lotNumber,
         product_image_url AS productImageUrl,
         starting_price   AS startingPrice,
         duration_seconds AS durationSeconds,
         status,
         created_at       AS createdAt
       FROM auctions
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    return rows.length > 0 ? (rows[0] as Auction) : null;
  }

  async updateStatus(id: string, status: "waiting" | "active" | "closed"): Promise<void> {
    await this.pool.execute(
      `UPDATE auctions SET status = ? WHERE id = ?`,
      [status, id]
    );
  }
}