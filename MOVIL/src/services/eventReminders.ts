import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../config';
import { getJson, setJson } from './storage';
import type { CalendarEvent } from './eventsIcs';

type ReminderStore = Record<string, { notificationId: string; scheduledForIso: string }>;

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  if (isExpoGo()) return false;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

export async function getEventReminders(): Promise<ReminderStore> {
  return (await getJson<ReminderStore>(STORAGE_KEYS.eventReminders)) ?? {};
}

export async function scheduleEventReminder(params: { event: CalendarEvent; minutesBefore: number }) {
  if (Platform.OS === 'web') throw new Error('No disponible en web');
  if (isExpoGo()) throw new Error('Requiere development build (no Expo Go)');

  const ok = await ensurePermission();
  if (!ok) throw new Error('Permiso de notificaciones denegado');

  const fireAt = new Date(params.event.startDate.getTime() - params.minutesBefore * 60 * 1000);
  if (fireAt.getTime() <= Date.now() + 5000) throw new Error('El recordatorio quedaría en el pasado');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📅 Evento',
      body: `${params.event.title} en ${params.minutesBefore} min`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });

  const store = await getEventReminders();
  store[params.event.id] = { notificationId: String(notificationId), scheduledForIso: fireAt.toISOString() };
  await setJson(STORAGE_KEYS.eventReminders, store);
  return store[params.event.id];
}

export async function cancelEventReminder(eventId: string) {
  if (Platform.OS === 'web') return;
  if (isExpoGo()) return;

  const store = await getEventReminders();
  const entry = store[eventId];
  if (!entry?.notificationId) return;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  try {
    await Notifications.cancelScheduledNotificationAsync(String(entry.notificationId));
  } catch {
    // ignore
  }

  delete store[eventId];
  await setJson(STORAGE_KEYS.eventReminders, store);
}

