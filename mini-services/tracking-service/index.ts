import { createServer } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: { url: 'file:/home/z/my-project/db/custom.db' },
  },
})

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Track admin sockets for broadcasting
const adminSockets = new Set<string>()

io.on('connection', (socket) => {
  console.log(`[tracking] Socket connected: ${socket.id}`)

  // Emit connected event with server time
  socket.emit('connected', {
    socketId: socket.id,
    serverTime: new Date().toISOString(),
  })

  // --- Join a delivery room to track real-time updates ---
  socket.on('join:delivery', (deliveryId: string) => {
    const room = `delivery:${deliveryId}`
    socket.join(room)
    console.log(`[tracking] Socket ${socket.id} joined room ${room}`)
  })

  // --- Leave a delivery room ---
  socket.on('leave:delivery', (deliveryId: string) => {
    const room = `delivery:${deliveryId}`
    socket.leave(room)
    console.log(`[tracking] Socket ${socket.id} left room ${room}`)
  })

  // --- Register as admin for global broadcasts ---
  socket.on('register:admin', () => {
    adminSockets.add(socket.id)
    socket.join('admins')
    console.log(`[tracking] Admin registered: ${socket.id}`)
  })

  // --- Update courier location ---
  socket.on('update:location', async (data: { deliveryId: string; lat: number; lng: number }) => {
    const { deliveryId, lat, lng } = data
    const room = `delivery:${deliveryId}`
    const timestamp = new Date().toISOString()

    console.log(`[tracking] Location update for ${deliveryId}: (${lat}, ${lng})`)

    io.to(room).emit('location:update', { lat, lng, timestamp })
  })

  // --- Update delivery status ---
  socket.on('update:status', async (data: { deliveryId: string; status: string; comment?: string }) => {
    const { deliveryId, status, comment } = data
    const timestamp = new Date().toISOString()

    console.log(`[tracking] Status update for ${deliveryId}: ${status}${comment ? ` - ${comment}` : ''}`)

    try {
      // Update delivery status in DB
      await prisma.delivery.update({
        where: { id: deliveryId },
        data: { status },
      })

      // Create Timeline event in DB
      await prisma.timeline.create({
        data: {
          event: status,
          comment: comment || null,
          deliveryId,
        },
      })

      // Broadcast status update to room
      const room = `delivery:${deliveryId}`
      io.to(room).emit('status:update', { status, comment, timestamp })

      console.log(`[tracking] Status updated and broadcast for ${deliveryId}`)
    } catch (error) {
      console.error(`[tracking] Error updating status for ${deliveryId}:`, error)
      socket.emit('error', { message: 'Failed to update delivery status', deliveryId })
    }
  })

  // --- New delivery notification ---
  socket.on('new:delivery', (data: Record<string, unknown>) => {
    console.log(`[tracking] New delivery created, broadcasting to admins`)

    // Broadcast to all admin sockets
    io.to('admins').emit('delivery:created', {
      ...data,
      timestamp: new Date().toISOString(),
    })
  })

  // --- Disconnect ---
  socket.on('disconnect', () => {
    adminSockets.delete(socket.id)
    console.log(`[tracking] Socket disconnected: ${socket.id}, admins online: ${adminSockets.size}`)
  })

  // --- Error handling ---
  socket.on('error', (error) => {
    console.error(`[tracking] Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[tracking] 🚀 Coursier B2B Tracking Service running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[tracking] Received SIGTERM, shutting down...')
  await prisma.$disconnect()
  httpServer.close(() => {
    console.log('[tracking] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log('[tracking] Received SIGINT, shutting down...')
  await prisma.$disconnect()
  httpServer.close(() => {
    console.log('[tracking] Server closed')
    process.exit(0)
  })
})
