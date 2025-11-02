'use client';

import { useEffect, useRef, useState } from 'react';
import { env } from '~/env.client';

export interface HubWebSocketMessage {
  type:
    | 'state_changed'
    | 'telemetry'
    | 'device_lifecycle'
    | 'command'
    | 'alert_triggered'
    | 'alert_resolved'
    | 'error'
    | 'connected';
  data: unknown;
  timestamp: string;
}

export interface UseHubWebSocketOptions {
  onMessage?: (message: HubWebSocketMessage) => void;
  onAlertTriggered?: (event: unknown) => void;
  onAlertResolved?: (event: unknown) => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export function useHubWebSocket(options: UseHubWebSocketOptions = {}) {
  const {
    onMessage,
    onAlertTriggered,
    onAlertResolved,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<HubWebSocketMessage | null>(
    null,
  );
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  useEffect(() => {
    shouldReconnectRef.current = true;

    const connect = () => {
      try {
        const hubUrl = env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3200';
        const wsUrl = `${hubUrl.replace(/^http/, 'ws')}/events`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Hub WebSocket connected');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as HubWebSocketMessage;
            setLastMessage(message);

            // Call general message handler
            onMessage?.(message);

            // Call specific handlers based on message type
            if (message.type === 'alert_triggered' && onAlertTriggered) {
              onAlertTriggered(message.data);
            } else if (message.type === 'alert_resolved' && onAlertResolved) {
              onAlertResolved(message.data);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (event) => {
          console.error('Hub WebSocket error:', event);
          onError?.(event);
        };

        ws.onclose = () => {
          console.log('Hub WebSocket disconnected');
          setIsConnected(false);
          wsRef.current = null;

          // Attempt to reconnect if enabled
          if (autoReconnect && shouldReconnectRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Attempting to reconnect to Hub WebSocket...');
              connect();
            }, reconnectDelay);
          }
        };
      } catch (error) {
        console.error('Error connecting to Hub WebSocket:', error);
      }
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [
    onMessage,
    onAlertTriggered,
    onAlertResolved,
    onError,
    autoReconnect,
    reconnectDelay,
  ]);

  const sendMessage = (message: unknown) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Cannot send message.');
    }
  };

  return {
    isConnected,
    lastMessage,
    sendMessage,
  };
}
