import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getDatabase(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:            process.env.DB_HOST     ?? "localhost",
      port:            Number(process.env.DB_PORT ?? 3306),
      user:            process.env.DB_USER     ?? "auction_user",
      password:        process.env.DB_PASSWORD ?? "auction_pass",
      database:        process.env.DB_NAME     ?? "live_auction",
      charset:         "utf8mb4",
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
    });
    console.log("MySQL pool created");
  }
  return pool;
}
