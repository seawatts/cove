/**
 * WebSocket handler for Hub V2
 * Streams real-time events via EventBus
 */

import { debug } from '@cove/logger';
import type { ServerWebSocket } from 'bun';
import type { HubDaemon } from '../daemon';

const log = debug('cove:hub-v2:websocket');

// Extended WebSocket interface to store unsubscribe functions
interface ExtendedServerWebSocket extends ServerWebSocket<undefined> {
  unsubscribeFunctions?: (() => void)[];
}

export interface WebSocketMessage {
  type:
    | 'state_changed'
    | 'telemetry'
    | 'device_lifecycle'
    | 'command'
    | 'error';
  data: unknown;
  timestamp: string;
}

/**
 * Create WebSocket handler for the daemon
 */
export function createWebSocketHandler(daemon: HubDaemon) {
  const connectedClients = new Set<ExtendedServerWebSocket>();

  /**
   * Handle WebSocket upgrade
   */
  function handleWebSocketUpgrade(req: Request): Response | undefined {
    const url = new URL(req.url);

    // Only handle /events endpoint
    if (url.pathname !== '/events') {
      return undefined;
    }

    // For now, return a simple response indicating WebSocket upgrade is not implemented
    // The actual WebSocket handling should be done at the server level
    return new Response('WebSocket upgrade not implemented in handler', {
      status: 501,
    });
  }

  /**
   * Handle WebSocket connection open
   */
  function handleWebSocketOpen(ws: ExtendedServerWebSocket) {
    connectedClients.add(ws);
    log(`WebSocket client connected (${connectedClients.size} total)`);

    // Send welcome message
    ws.send(
      JSON.stringify({
        data: { message: 'Connected to Hub V2 WebSocket' },
        timestamp: new Date().toISOString(),
        type: 'connected',
      }),
    );

    // Subscribe to events
    subscribeToEvents(ws);
  }

  /**
   * Handle WebSocket connection close
   */
  function handleWebSocketClose(
    ws: ExtendedServerWebSocket,
    code: number,
    reason: string,
  ) {
    connectedClients.delete(ws);
    log(
      `WebSocket client disconnected (${connectedClients.size} total): ${code} ${reason}`,
    );

    // Unsubscribe from events
    unsubscribeFromEvents(ws);
  }

  /**
   * Handle WebSocket message
   */
  function _handleWebSocketMessage(
    ws: ExtendedServerWebSocket,
    message: string | Buffer<ArrayBuffer>,
  ) {
    try {
      const data = JSON.parse(message.toString());

      // Handle different message types
      switch (data.type) {
        case 'subscribe':
          handleSubscribe(ws, data.topics);
          break;
        case 'unsubscribe':
          handleUnsubscribe(ws, data.topics);
          break;
        case 'ping':
          ws.send(
            JSON.stringify({
              data: {},
              timestamp: new Date().toISOString(),
              type: 'pong',
            }),
          );
          break;
        default:
          log(`Unknown WebSocket message type: ${data.type}`);
      }
    } catch (error) {
      log('Error handling WebSocket message:', error);
      ws.send(
        JSON.stringify({
          data: { error: 'Invalid message format' },
          timestamp: new Date().toISOString(),
          type: 'error',
        }),
      );
    }
  }

  /**
   * Subscribe WebSocket client to events
   */
  function subscribeToEvents(ws: ExtendedServerWebSocket) {
    const eventBus = daemon.getEventBus();
    if (!eventBus) return;

    // Subscribe to state changes
    const stateUnsub = eventBus.subscribe('entity/*/state', (event) => {
      sendToClient(ws, {
        data: event,
        type: 'state_changed',
      });
    });

    // Subscribe to device lifecycle events
    const lifecycleUnsub = eventBus.subscribe('device/*/lifecycle', (event) => {
      sendToClient(ws, {
        data: event,
        type: 'device_lifecycle',
      });
    });

    // Subscribe to telemetry
    const telemetryUnsub = eventBus.subscribe('telemetry', (event) => {
      sendToClient(ws, {
        data: event,
        type: 'telemetry',
      });
    });

    // Subscribe to command events
    const commandUnsub = eventBus.subscribe('command/*', (event) => {
      sendToClient(ws, {
        data: event,
        type: 'command',
      });
    });

    // Subscribe to errors
    const errorUnsub = eventBus.subscribe('error', (event) => {
      sendToClient(ws, {
        data: event,
        type: 'error',
      });
    });

    // Store unsubscribe functions on WebSocket object
    ws.unsubscribeFunctions = [
      stateUnsub,
      lifecycleUnsub,
      telemetryUnsub,
      commandUnsub,
      errorUnsub,
    ];
  }

  /**
   * Unsubscribe WebSocket client from events
   */
  function unsubscribeFromEvents(ws: ExtendedServerWebSocket) {
    const unsubscribeFunctions = ws.unsubscribeFunctions;
    if (unsubscribeFunctions) {
      for (const unsub of unsubscribeFunctions) {
        unsub();
      }
      delete ws.unsubscribeFunctions;
    }
  }

  /**
   * Handle subscribe message
   */
  function handleSubscribe(_ws: ExtendedServerWebSocket, topics: string[]) {
    log(`Client subscribing_wso topics: ${topics.join(', ')}`);
    // For now, we subscribe to all events
    // This could be enhanced to support selective subscriptions
  }

  /**
   * Handle unsubscribe message
   */
  function handleUnsubscribe(_ws: ExtendedServerWebSocket, topics: string[]) {
    log(`Client unsubscribing_wsrom topics: ${topics.join(', ')}`);
    // For now, we don't support selective unsubscription
  }

  /**
   * Send message to WebSocket client
   */
  function sendToClient(
    ws: ExtendedServerWebSocket,
    message: Omit<WebSocketMessage, 'timestamp'>,
  ) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const fullMessage: WebSocketMessage = {
          ...message,
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(fullMessage));
      } catch (error) {
        log('Error sending WebSocket message:', error);
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  function broadcast(message: Omit<WebSocketMessage, 'timestamp'>) {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    for (const ws of connectedClients) {
      sendToClient(ws, fullMessage);
    }
  }

  /**
   * Get connected client count
   */
  function getConnectedClientCount(): number {
    return connectedClients.size;
  }

  /**
   * Close all connections
   */
  function closeAllConnections() {
    for (const ws of connectedClients) {
      try {
        ws.close(1000, 'Server shutdown');
      } catch (error) {
        log('Error closing WebSocket connection:', error);
      }
    }
    connectedClients.clear();
  }

  return {
    broadcast,
    closeAllConnections,
    getConnectedClientCount,
    handleWebSocketClose,
    handleWebSocketOpen,
    handleWebSocketUpgrade,
  };
}

/**
 * WebSocket configuration for Bun.serve
 */
export const websocketConfig = {
  close: (_ws: ExtendedServerWebSocket, code: number, reason: string) => {
    log(`WebSocket connection closed: ${code} ${reason}`);
  },
  message: (
    _ws: ExtendedServerWebSocket,
    message: string | Buffer<ArrayBuffer>,
  ) => {
    // This will be handled by the individual WebSocket handler
    log('WebSocket message received:', message.toString());
  },
  open: (_ws: ExtendedServerWebSocket) => {
    log('WebSocket connection opened');
  },
};
