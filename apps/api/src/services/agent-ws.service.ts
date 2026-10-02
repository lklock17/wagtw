import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface AgentClient {
  ws: WebSocket;
  phoneId: string;
  deviceIds: Set<string>;
  isAlive: boolean;
}

const clients = new Map<string, AgentClient>(); // key: phoneId

let wss: WebSocketServer | null = null;
let statusHandler: ((messageId: string, status: string, error?: string, deviceStatus?: string) => Promise<void>) | null = null;

export const setAgentWsStatusHandler = (
  handler: (messageId: string, status: string, error?: string, deviceStatus?: string) => Promise<void>
) => {
  statusHandler = handler;
};

export const setupAgentWebSocket = (server: Server) => {
  wss = new WebSocketServer({
    server,
    path: '/api/agent/ws'
  });

  wss.on('connection', (ws: WebSocket, req) => {
    let currentPhoneId = '';
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const queryPhoneId = url.searchParams.get('phoneId');
      const queryDeviceIds = url.searchParams.get('deviceIds');

      const agent: AgentClient = {
        ws,
        phoneId: queryPhoneId || '',
        deviceIds: new Set(queryDeviceIds ? queryDeviceIds.split(',').filter(Boolean) : []),
        isAlive: true
      };

      if (queryPhoneId) {
        currentPhoneId = queryPhoneId;
        clients.set(queryPhoneId, agent);
        console.log(`[Agent WS] ⚡ HP Connected via WebSocket: ${queryPhoneId}`);
      }

      ws.on('pong', () => {
        agent.isAlive = true;
      });

      ws.on('message', async (data: any) => {
        try {
          const raw = data.toString();
          const msg = JSON.parse(raw);

          if (msg.type === 'REGISTER') {
            currentPhoneId = msg.phoneId || currentPhoneId;
            agent.phoneId = currentPhoneId;
            if (Array.isArray(msg.deviceIds)) {
              agent.deviceIds = new Set(msg.deviceIds.filter(Boolean));
            }
            clients.set(currentPhoneId, agent);
            ws.send(JSON.stringify({ type: 'REGISTER_ACK', success: true }));
            console.log(`[Agent WS] 📱 Registered HP ${currentPhoneId} with devices: ${Array.from(agent.deviceIds).join(', ')}`);
          } else if (msg.type === 'MESSAGE_STATUS') {
            if (statusHandler) {
              await statusHandler(msg.messageId, msg.status, msg.error, msg.deviceStatus);
            }
            ws.send(JSON.stringify({ type: 'STATUS_ACK', messageId: msg.messageId }));
          } else if (msg.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch (err: any) {
          console.error('[Agent WS] Parse message error:', err.message);
        }
      });

      ws.on('close', () => {
        if (currentPhoneId) {
          clients.delete(currentPhoneId);
          console.log(`[Agent WS] HP Disconnected: ${currentPhoneId}`);
        }
      });

      ws.on('error', (err) => {
        console.error('[Agent WS] Socket error:', err.message);
      });
    } catch (e: any) {
      console.error('[Agent WS] Connection initialization error:', e.message);
    }
  });

  // Ping interval to keep connection active through mobile carrier NAT
  const pingInterval = setInterval(() => {
    if (!wss) return;
    for (const [phoneId, agent] of clients.entries()) {
      if (!agent.isAlive) {
        console.log(`[Agent WS] Heartbeat failed, closing inactive socket: ${phoneId}`);
        agent.ws.terminate();
        clients.delete(phoneId);
        continue;
      }
      agent.isAlive = false;
      agent.ws.ping();
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });
};

export const sendInstantMessageToAgent = (deviceId: string, payload: any): boolean => {
  for (const agent of clients.values()) {
    if (agent.deviceIds.has(deviceId) && agent.ws.readyState === WebSocket.OPEN) {
      agent.ws.send(JSON.stringify({
        type: 'DISPATCH_MESSAGE',
        deviceId,
        ...payload
      }));
      console.log(`⚡ [Agent WS] Dispatched INSTANT real-time message ${payload.id} to HP ${agent.phoneId} for device ${deviceId}`);
      return true;
    }
  }
  return false;
};
