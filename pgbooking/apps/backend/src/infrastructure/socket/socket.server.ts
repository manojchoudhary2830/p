import { Server as SocketIOServer } from 'socket.io';

// ─────────────────────────────────────────────
// Singleton accessor
// The Socket.IO server instance is created in app.ts via createSocketServer()
// and stored here so BullMQ workers can access it without circular imports.
// ─────────────────────────────────────────────

let _io: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer): void {
  _io = io;
}

export function getSocketIO(): SocketIOServer {
  if (!_io) throw new Error('Socket.IO server not initialised. Call setSocketIO() first in app.ts.');
  return _io;
}

// ─────────────────────────────────────────────
// Convenience emitters used by workers
// ─────────────────────────────────────────────

export function emitToUser(userId: string, event: string, data: unknown): void {
  try {
    getSocketIO().to(`user:${userId}`).emit(event, data);
  } catch {
    // Non-fatal — socket server may not be running in worker-only mode
  }
}

export function emitToBooking(bookingId: string, event: string, data: unknown): void {
  try {
    getSocketIO().to(`booking:${bookingId}`).emit(event, data);
  } catch {
    // Non-fatal
  }
}
