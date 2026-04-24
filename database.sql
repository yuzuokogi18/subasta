-- ============================================================
--  Live Auction – MySQL Database Script
--  Proyecto: Aplicaciones en Tiempo Real
--  Ejecutar: mysql -u root -p < database.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS live_auction
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE live_auction;

-- ─── TABLA 1: AUCTIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS auctions (
    id                CHAR(36)       PRIMARY KEY,
    product_name      VARCHAR(150)   NOT NULL,
    lot_number        VARCHAR(20)    NOT NULL,
    product_image_url TEXT           NULL,        -- ← nueva
    starting_price    DECIMAL(10,2)  NOT NULL DEFAULT 1000,
    duration_seconds  INT            NOT NULL DEFAULT 120,
    status            ENUM('waiting','active','closed') NOT NULL DEFAULT 'waiting',
    created_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_auctions_status ON auctions(status);

-- ─── TABLA 2: PARTICIPANTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS participants (
    id              VARCHAR(50)  PRIMARY KEY,
    nickname        VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    connected_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    disconnected_at DATETIME     NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_participants_active ON participants(is_active);

-- ─── TABLA 3: BIDS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bids (
    id          CHAR(36)       PRIMARY KEY,
    auction_id  CHAR(36)       NOT NULL,
    user_id     VARCHAR(50)    NOT NULL,
    amount      DECIMAL(10,2)  NOT NULL,
    status      ENUM('accepted','rejected') NOT NULL DEFAULT 'accepted',
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bids_auction FOREIGN KEY (auction_id)
        REFERENCES auctions(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_bids_user FOREIGN KEY (user_id)
        REFERENCES participants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_user_id    ON bids(user_id);
CREATE INDEX idx_bids_status     ON bids(status);
CREATE INDEX idx_bids_created    ON bids(created_at);

-- ─── TABLA 4: AUCTION_RESULTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_results (
    id                  CHAR(36)       PRIMARY KEY,
    auction_id          CHAR(36)       NOT NULL,
    winner_user_id      VARCHAR(50)    NULL,
    final_price         DECIMAL(10,2)  NOT NULL DEFAULT 0,
    total_bids          INT            NOT NULL DEFAULT 0,
    total_participants  INT            NOT NULL DEFAULT 0,
    started_at          DATETIME       NULL,
    ended_at            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_results_auction FOREIGN KEY (auction_id)
        REFERENCES auctions(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_result_winner FOREIGN KEY (winner_user_id)
        REFERENCES participants(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_results_auction ON auction_results(auction_id);

-- ─── VISTAS ──────────────────────────────────────────────────

-- Vista: Todas las subastas con su resultado
CREATE OR REPLACE VIEW v_subastas AS
SELECT
    a.id,
    a.product_name,
    a.lot_number,
    a.starting_price,
    a.duration_seconds,
    a.status,
    a.created_at,
    ar.final_price,
    ar.total_bids,
    ar.total_participants,
    ar.started_at,
    ar.ended_at,
    TIMESTAMPDIFF(SECOND, ar.started_at, ar.ended_at) AS duracion_segundos,
    p.nickname   AS winner_nickname,
    p.avatar_url AS winner_avatar
FROM auctions a
LEFT JOIN auction_results ar ON ar.auction_id = a.id
LEFT JOIN participants p     ON p.id = ar.winner_user_id
ORDER BY a.created_at DESC;

-- Vista: Ranking de participantes por actividad
CREATE OR REPLACE VIEW v_ranking_participantes AS
SELECT
    p.id,
    p.nickname,
    p.avatar_url,
    p.is_active,
    COUNT(b.id)                                                AS total_pujas,
    SUM(CASE WHEN b.status = 'accepted' THEN 1 ELSE 0 END)    AS pujas_aceptadas,
    SUM(CASE WHEN b.status = 'rejected' THEN 1 ELSE 0 END)    AS pujas_rechazadas,
    MAX(b.created_at)                                          AS ultima_puja
FROM participants p
LEFT JOIN bids b ON b.user_id = p.id
GROUP BY p.id, p.nickname, p.avatar_url, p.is_active
ORDER BY pujas_aceptadas DESC;

-- Vista: Historial de pujas con nickname y subasta
CREATE OR REPLACE VIEW v_historial_pujas AS
SELECT
    b.id,
    b.amount,
    b.status,
    b.created_at,
    p.id           AS user_id,
    p.nickname,
    p.avatar_url,
    a.id           AS auction_id,
    a.product_name,
    a.lot_number
FROM bids b
INNER JOIN participants p ON p.id = b.user_id
INNER JOIN auctions     a ON a.id = b.auction_id
ORDER BY b.created_at DESC;

-- Vista: Resumen de la última subasta cerrada
CREATE OR REPLACE VIEW v_resumen_subasta AS
SELECT
    ar.id,
    ar.final_price,
    ar.total_bids,
    ar.total_participants,
    ar.started_at,
    ar.ended_at,
    TIMESTAMPDIFF(SECOND, ar.started_at, ar.ended_at) AS duracion_segundos,
    a.product_name,
    a.lot_number,
    p.nickname   AS winner_nickname,
    p.avatar_url AS winner_avatar
FROM auction_results ar
INNER JOIN auctions    a ON a.id  = ar.auction_id
LEFT  JOIN participants p ON p.id = ar.winner_user_id
ORDER BY ar.ended_at DESC
LIMIT 1;

-- ─── STORED PROCEDURES ───────────────────────────────────────

-- Procedimiento: obtener participantes con estadísticas
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS sp_get_participants()
BEGIN
    SELECT
        p.id,
        p.nickname,
        p.avatar_url      AS avatarUrl,
        p.connected_at    AS connectedAt,
        p.disconnected_at AS disconnectedAt,
        p.is_active       AS isActive,
        COUNT(b.id)       AS bidCount,
        MAX(b.created_at) AS lastBidAt
    FROM participants p
    LEFT JOIN bids b ON b.user_id = p.id AND b.status = 'accepted'
    GROUP BY p.id, p.nickname, p.avatar_url, p.connected_at, p.disconnected_at, p.is_active
    ORDER BY bidCount DESC;
END$$

-- Procedimiento: obtener pujas de una subasta específica
CREATE PROCEDURE IF NOT EXISTS sp_get_bids_by_auction(IN p_auction_id CHAR(36))
BEGIN
    SELECT
        b.id,
        b.amount,
        b.status,
        b.created_at      AS createdAt,
        p.id              AS userId,
        p.nickname,
        p.avatar_url      AS avatarUrl
    FROM bids b
    INNER JOIN participants p ON p.id = b.user_id
    WHERE b.auction_id = p_auction_id
    ORDER BY b.created_at DESC;
END$$
DELIMITER ;

-- ─── DATOS DE PRUEBA (comentar en producción) ────────────────
/*
INSERT INTO auctions (id, product_name, lot_number, starting_price, duration_seconds, status) VALUES
  (UUID(), 'Reloj Chrono-Master',    '4421', 1000.00, 120, 'closed'),
  (UUID(), 'Laptop Gaming Pro',      '4422', 2000.00, 120, 'waiting'),
  (UUID(), 'Cámara Mirrorless Sony', '4423', 1500.00, 120, 'waiting');
*/