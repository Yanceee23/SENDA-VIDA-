import { getDatabase, ref, push, get, onChildAdded, type Unsubscribe } from 'firebase/database';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { FIREBASE_CONFIG } from '../config';

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!FIREBASE_CONFIG.databaseURL || !FIREBASE_CONFIG.apiKey) return null;
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) return existing[0] as FirebaseApp;
  try {
    app = initializeApp(FIREBASE_CONFIG);
    return app;
  } catch {
    return null;
  }
}

export type ChatMessage = {
  id: string;
  autor: string;
  autorId: number;
  texto: string;
  timestamp: number;
};

const CHAT_ID = 'global';

function messagesRef() {
  const a = getFirebaseApp();
  if (!a) return null;
  return ref(getDatabase(a), `chats/${CHAT_ID}/messages`);
}

export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.apiKey);
}

export async function getMensajes(): Promise<ChatMessage[]> {
  const r = messagesRef();
  if (!r) return [];
  try {
    const snapshot = await get(r);
    const val = snapshot.val();
    if (!val || typeof val !== 'object') return [];
    return Object.entries(val)
      .map(([key, v]) => {
        const x = v as Record<string, unknown>;
        return {
          id: key,
          autor: String(x?.autor ?? 'Anónimo'),
          autorId: Number(x?.autorId ?? 0),
          texto: String(x?.texto ?? ''),
          timestamp: Number(x?.timestamp ?? 0),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

export async function sendMessage(autor: string, autorId: number, texto: string): Promise<void> {
  const r = messagesRef();
  if (!r) throw new Error('Firebase no configurado. Añade EXPO_PUBLIC_FIREBASE_* en .env');
  await push(r, {
    autor,
    autorId,
    texto: texto.trim(),
    timestamp: Date.now(),
  });
}

export function subscribeToMessages(
  onMessage: (msg: ChatMessage) => void
): Unsubscribe | null {
  const r = messagesRef();
  if (!r) return null;
  return onChildAdded(r, (snapshot) => {
    const val = snapshot.val();
    if (!val || typeof val !== 'object') return;
    const msg: ChatMessage = {
      id: snapshot.key ?? '',
      autor: String(val.autor ?? 'Anónimo'),
      autorId: Number(val.autorId ?? 0),
      texto: String(val.texto ?? ''),
      timestamp: Number(val.timestamp ?? 0),
    };
    onMessage(msg);
  });
}
