# Task 4: Tracking Service Agent

## Status: COMPLETED

## Files Created
- `/home/z/my-project/mini-services/tracking-service/package.json` — package config with socket.io + @prisma/client
- `/home/z/my-project/mini-services/tracking-service/index.ts` — Socket.io server on port 3003

## Dependencies Installed
- socket.io@4.8.3
- @prisma/client@7.9.1

## Service Details
- **Port**: 3003
- **Caddy**: Uses path `/` with `XTransformPort=3003` query param
- **Database**: PrismaClient pointing to `file:/home/z/my-project/db/custom.db`
- **CORS**: origin `*`

## Socket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `connected` | Server → Client | Emits `{ socketId, serverTime }` on connection |
| `join:delivery` | Client → Server | `(deliveryId)` — joins room `delivery:{id}` |
| `leave:delivery` | Client → Server | `(deliveryId)` — leaves room |
| `register:admin` | Client → Server | Joins admin room for global broadcasts |
| `update:location` | Client → Server | `(deliveryId, lat, lng)` → broadcasts `location:update` to room |
| `update:status` | Client → Server | `(deliveryId, status, comment)` → updates DB, creates Timeline, broadcasts `status:update` |
| `new:delivery` | Client → Server | Broadcasts `delivery:created` to all admins |

## Frontend Connection
```ts
io('/?XTransformPort=3003')
```

## Process
- PID verified running on port 3003
- Started with `bun --hot index.ts` for auto-reload during development
