# 🏷️ Live Auction – Onion Architecture Backend (TypeScript)

Backend **Node.js + TypeScript** con **Onion Architecture**, **WebSocket** y **SQLite**.

---

## 🧅 Arquitectura en Capas (Onion)

```
┌──────────────────────────────────────────────┐
│           INFRASTRUCTURE (outer)             │
│  ┌────────────────────────────────────────┐  │
│  │         APPLICATION                    │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │          DOMAIN (core)           │  │  │
│  │  │  Entities · Repositories (iface) │  │  │
│  │  │  DomainService                   │  │  │
│  │  └──────────────────────────────────┘  │  │
│  │  UseCases · DTOs                       │  │  
│  └────────────────────────────────────────┘  │
│  Database · WebSocket · HTTP · DI Container  │
└──────────────────────────────────────────────┘
```

### Capas

| Capa | Responsabilidad | Depende de |
|---|---|---|
| **Domain** | Entidades, reglas de negocio, interfaces de repositorios | Nada |
| **Application** | Casos de uso, DTOs, orquestación | Domain |
| **Infrastructure** | SQLite, WebSocket, HTTP, DI Container | Application + Domain |

---

## 📁 Estructura del Proyecto

```
src/
├── domain/
│   ├── entities/
│   │   ├── Participant.ts
│   │   ├── Bid.ts
│   │   ├── AuctionResult.ts
│   │   └── AuctionState.ts        ← Value object + config
│   ├── repositories/
│   │   ├── IParticipantRepository.ts
│   │   ├── IBidRepository.ts
│   │   └── IAuctionResultRepository.ts
│   └── services/
│       └── AuctionDomainService.ts ← Reglas de negocio puras
│
├── application/
│   ├── dtos/
│   │   └── AuctionDtos.ts         ← Tipos de eventos WS
│   └── use-cases/
│       ├── JoinAuctionUseCase.ts
│       ├── PlaceBidUseCase.ts
│       ├── CloseAuctionUseCase.ts
│       ├── DisconnectParticipantUseCase.ts
│       └── GetParticipantsUseCase.ts
│
├── infrastructure/
│   ├── database/
│   │   ├── DatabaseConnection.ts   ← Singleton + migraciones
│   │   ├── SqliteParticipantRepository.ts
│   │   ├── SqliteBidRepository.ts
│   │   └── SqliteAuctionResultRepository.ts
│   ├── websocket/
│   │   └── AuctionWebSocketServer.ts
│   ├── http/
│   │   └── HttpApiServer.ts
│   └── di/
│       └── Container.ts            ← Composition Root
│
├── shared/
│   └── errors/
│       └── AppErrors.ts
│
└── index.ts                        ← Entry point
```

---

## 🚀 Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Modo desarrollo (auto-reload)
npm run dev

# Compilar TypeScript
npm run build

# Producción
npm start
```

Servidores levantados:
- **WebSocket** → `ws://localhost:8080`
- **HTTP API**  → `http://localhost:3000`

---

## 📡 Eventos WebSocket

### Cliente → Servidor

```jsonc
// Unirse a la subasta
{ "type": "join", "userId": "user_a8f3x91", "nickname": "OferenteVeloz", "avatarUrl": "..." }

// Realizar puja
{ "type": "place_bid", "amount": 1010 }
```

### Servidor → Cliente (broadcast / individual)

```jsonc
// Estado actual al conectarse
{ "type": "auction_state", "data": { "product": "...", "currentPrice": 1000, "timeRemaining": 120, ... } }

// Puja aceptada (broadcast)
{ "type": "bid_accepted", "data": { "bidId": "uuid", "newPrice": 1010, "extended": false, ... } }

// Puja rechazada (solo al usuario)
{ "type": "bid_rejected", "data": { "reason": "Expected $1010, got $1050", "currentPrice": 1000 } }

// Tick del temporizador
{ "type": "timer_tick", "data": { "timeRemaining": 60 } }

// Subasta cerrada (broadcast)
{ "type": "auction_closed", "data": { "winnerId": "...", "finalPrice": 1250, ... } }
```

---

## 🌐 HTTP Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/participants` | Ranking de participantes |
| GET | `/state` | Estado actual de la subasta |
| GET | `/result` | Resultado de la última subasta |

---

## 🗄️ Base de Datos

La DB `auction.db` se crea automáticamente con migraciones al iniciar.

### Tablas
- `participants` — Usuarios conectados
- `bids` — Todas las pujas (aceptadas y rechazadas)
- `auction_results` — Resultado final de cada subasta

### Vista útil
```sql
SELECT * FROM v_ranking_participantes;
```
