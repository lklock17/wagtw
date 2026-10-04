import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { prisma } from '@wagtw/database';

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

export const getActivePhoneIds = (): string[] => {
  return Array.from(clients.keys());
};

export const setupAgentWebSocket = (server: Server) => {
  wss = new WebSocketServer({
    server,
    path: '/api/agent/ws'
  });

  const touchDevices = async (deviceIds: Set<string>) => {
    if (deviceIds.size > 0) {
      try {
        await prisma.device.updateMany({
          where: { id: { in: Array.from(deviceIds) } },
          data: { status: 'CONNECTED', lastConnected: new Date() }
        });
      } catch (e) {}
    }
  };

  const ensurePhoneDevices = async (phoneId: string, agent: AgentClient) => {
    if (!phoneId) return;
    try {
      // Find devices in DB belonging to this phoneId
      let existingDevs = await prisma.device.findMany({
        where: {
          sessionData: { contains: `"phoneId":"${phoneId}"` }
        }
      });

      // If no devices exist in DB yet for this connected phone, auto-provision personal slot 1
      if (existingDevs.length === 0) {
        const shortId = phoneId.replace('phone_', '').slice(0, 6);
        const devName = `HP Agen (${shortId}) - Personal (Slot 1)`;
        const newDev = await prisma.device.create({
          data: {
            name: devName,
            status: 'CONNECTED',
            lastConnected: new Date(),
            sessionData: JSON.stringify({
              type: 'ANDROID_AGENT',
              phoneId,
              phoneName: `HP Agen (${shortId})`,
              model: 'Android Phone',
              slot: 'PERSONAL_1',
              slotLabel: 'Personal (Slot 1)',
              accountType: 'PERSONAL',
              targetPackage: 'com.whatsapp',
              dualAppTarget: 'ACCOUNT_1'
            })
          }
        });
        existingDevs = [newDev];
      }

      for (const d of existingDevs) {
        agent.deviceIds.add(d.id);
      }

      await touchDevices(agent.deviceIds);
    } catch (e: any) {
      console.error(`[Agent WS] Failed to ensure devices for ${phoneId}:`, e.message);
    }
  };

  wss.on('connection', async (ws: WebSocket, req) => {
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
        await ensurePhoneDevices(queryPhoneId, agent);
      }

      ws.on('pong', () => {
        agent.isAlive = true;
        touchDevices(agent.deviceIds);
      });

      ws.on('message', async (data: any) => {
        try {
          const raw = data.toString();
          const msg = JSON.parse(raw);

          if (msg.type === 'REGISTER') {
            currentPhoneId = msg.phoneId || currentPhoneId;
            agent.phoneId = currentPhoneId;
            if (Array.isArray(msg.deviceIds)) {
              for (const id of msg.deviceIds) {
                if (id) agent.deviceIds.add(id);
              }
            }
            await ensurePhoneDevices(currentPhoneId, agent);
            clients.set(currentPhoneId, agent);
            ws.send(JSON.stringify({ 
              type: 'REGISTER_ACK', 
              success: true,
              deviceIds: Array.from(agent.deviceIds)
            }));
            console.log(`[Agent WS] 📱 Registered HP ${currentPhoneId} with devices: ${Array.from(agent.deviceIds).join(', ')}`);
          } else if (msg.type === 'MESSAGE_STATUS') {
            if (statusHandler) {
              await statusHandler(msg.messageId, msg.status, msg.error, msg.deviceStatus);
            }
            ws.send(JSON.stringify({ type: 'STATUS_ACK', messageId: msg.messageId }));
          } else if (msg.type === 'PING') {
            agent.isAlive = true;
            touchDevices(agent.deviceIds);
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch (err: any) {
          console.error('[Agent WS] Parse message error:', err.message);
        }
      });

      ws.on('close', async () => {
        if (currentPhoneId) {
          clients.delete(currentPhoneId);
          console.log(`[Agent WS] HP Disconnected: ${currentPhoneId}`);
          try {
            await prisma.device.updateMany({
              where: {
                sessionData: { contains: `"phoneId":"${currentPhoneId}"` }
              },
              data: { status: 'DISCONNECTED' }
            });
          } catch (e) {}
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
