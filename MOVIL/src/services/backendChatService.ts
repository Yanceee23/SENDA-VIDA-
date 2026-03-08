import { Client } from '@stomp/stompjs';
import { apiRequest } from './api';

export type ChatMessage = {
  id: string;
  autor: string;
  autorId: number;
  texto: string;
  timestamp: number;
};

function toChatMessage(raw: Record<string, unknown>): ChatMessage {
  const id = raw.id != null ? String(raw.id) : '';
  const ts = typeof raw.timestamp === 'number'
    ? raw.timestamp
    : (raw.hora ? new Date(String(raw.hora)).getTime() : Date.now());
  return {
    id,
    autor: String(raw.autor ?? 'Anónimo'),
    autorId: Number(raw.autorId ?? 0),
    texto: String(raw.texto ?? ''),
    timestamp: ts,
  };
}

export function isBackendConfigured(apiBaseUrl: string | undefined): boolean {
  return Boolean(apiBaseUrl?.trim());
}

export async function getMensajes(apiBaseUrl: string): Promise<ChatMessage[]> {
  const raw = await apiRequest<Record<string, unknown>[]>(apiBaseUrl, 'comunidad/chat/mensajes');
  if (!Array.isArray(raw)) return [];
  return raw.map(toChatMessage);
}

export async function sendMessage(
  apiBaseUrl: string,
  autor: string,
  autorId: number,
  texto: string
): Promise<void> {
  await apiRequest(apiBaseUrl, 'comunidad/chat/mensajes', {
    method: 'POST',
    body: JSON.stringify({ autor, autorId, texto: texto.trim() }),
  });
}

function getWebSocketUrl(apiBaseUrl: string): string {
  const base = (apiBaseUrl ?? '').trim().replace(/\/+$/, '');
  const wsScheme = base.startsWith('https') ? 'wss' : 'ws';
  const wsHost = base.replace(/^https?:\/\//, '');
  return `${wsScheme}://${wsHost}/ws/chat`;
}

export function subscribeToMessages(
  apiBaseUrl: string,
  onMessage: (msg: ChatMessage) => void
): () => void {
  const wsUrl = getWebSocketUrl(apiBaseUrl);
  const client = new Client({
    brokerURL: wsUrl,
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });

  client.onConnect = () => {
    client.subscribe('/topic/chat/global', (message) => {
      try {
        const body = JSON.parse(message.body);
        onMessage(toChatMessage(body));
      } catch {
        // ignore malformed
      }
    });
  };

  client.onStompError = () => {
    // reconexión automática
  };

  client.activate();

  return () => {
    client.deactivate();
  };
}
