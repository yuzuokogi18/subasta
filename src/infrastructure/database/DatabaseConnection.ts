import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getDatabase(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:            process.env.DB_HOST     ?? "localhost",
      port:            Number(process.env.DB_PORT ?? 3306),
      user:            process.env.DB_USER     ?? "root",
      password:        process.env.DB_PASSWORD ?? "12345",
      database:        process.env.DB_NAME     ?? "liveauction",
      charset:         "utf8mb4",
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
    });
    console.log("MySQL pool created");
  }
  return pool;
}
