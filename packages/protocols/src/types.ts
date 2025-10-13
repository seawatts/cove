/**
 * Shared types for protocol implementations
 */

export interface ProtocolClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface ProtocolAdapter extends ProtocolClient {
  readonly name: string;
  readonly protocol: string;
}
