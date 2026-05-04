import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiRequest } from './api';
import { STORAGE_KEYS } from '../config';
import { getJson, setJson } from './storage';

type StoredPushToken = { userId: number; token: string };

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

async function getDevicePushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (isExpoGo()) return null; // En Expo Go no hay soporte completo para push remoto

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');

  try {
    const perm = await Notifications.getPermissionsAsync();
    const status = perm.status === 'granted' ? perm.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const tokenRes = await Notifications.getDevicePushTokenAsync();
    return tokenRes?.data ? String(tokenRes.data) : null;
  } catch {
    return null;
  }
}

export async function getDevicePushTokenForDebug() {
  return await getDevicePushToken();
}

export async function syncFcmTokenToBackend(params: { baseUrl: string; authToken?: string; userId: number }) {
  const deviceToken = await getDevicePushToken();
  if (!deviceToken) return;

  const prev = await getJson<StoredPushToken>(STORAGE_KEYS.pushToken);
  if (prev?.userId === params.userId && prev?.token === deviceToken) return;

  try {
    await apiRequest(params.baseUrl, '/auth/fcm-token', {
      method: 'PUT',
      token: params.authToken,
      body: JSON.stringify({ userId: params.userId, token: deviceToken }),
    });
    await setJson(STORAGE_KEYS.pushToken, { userId: params.userId, token: deviceToken });
  } catch {
    // No debe bloquear login ni causar rechazos no manejados; se reintentará en el próximo arranque.
  }
}

