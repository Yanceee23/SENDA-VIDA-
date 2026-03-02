import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as Contacts from 'expo-contacts';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { LargeButton } from '../../components/LargeButton';
import { apiRequest, toQuery } from '../../services/api';
import { INSTAGRAM_PROFILE_URL, STORAGE_KEYS } from '../../config';
import { useAuth } from '../../state/AuthContext';
import { useSettings } from '../../state/SettingsContext';
import { fetchIcs, parseIcsEvents, type CalendarEvent } from '../../services/eventsIcs';
import { cancelEventReminder, getEventReminders, scheduleEventReminder } from '../../services/eventReminders';
import { getJson, remove } from '../../services/storage';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';

type Grupo = { id: number; nombreGrupo: string; descripcion?: string; participantes?: number };
type Mensaje = { id: number; autor?: string; autorId?: number; texto: string; hora?: string };
type ContactoInvitable = { id: string; nombre: string; numero: string };
type GrupoCodigoLookup = { id?: number; groupId?: number; nombreGrupo?: string };

function normalizarNumero(raw: string): string {
  return raw.replace(/[\s\-\(\)\+]/g, '');
}

function toMensajeError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}

export function CommunityScreen() {
  const navigation = useNavigation<any>();
  const { settings } = useSettings();
  const { status, user, requireUserId } = useAuth();

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [grupoId, setGrupoId] = useState<number | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [joined, setJoined] = useState<Record<number, boolean>>({});

  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteGroup, setInviteGroup] = useState<Grupo | null>(null);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [joinCodeVisible, setJoinCodeVisible] = useState(false);
  const [invitePreparing, setInvitePreparing] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  const [contactsVisible, setContactsVisible] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [contactsQuery, setContactsQuery] = useState('');
  const [contactsList, setContactsList] = useState<ContactoInvitable[]>([]);

  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventReminders, setEventReminders] = useState<Record<string, { notificationId: string; scheduledForIso: string }>>({});

  const loadEventReminders = async () => {
    try {
      setEventReminders(await getEventReminders());
    } catch {
      // ignore
    }
  };

  const loadEvents = async () => {
    const url = settings.eventsCalendarIcsUrl?.trim();
    if (!url) {
      setEvents([]);
      setEventsError(null);
      return;
    }
    try {
      setEventsLoading(true);
      setEventsError(null);
      const text = await fetchIcs(url, { timeoutMs: 15000 });
      const parsed = parseIcsEvents(text)
        .filter((e) => e.startDate.getTime() >= Date.now() - 60 * 60 * 1000)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
        .slice(0, 10);
      setEvents(parsed);
    } catch (e: any) {
      setEvents([]);
      setEventsError(String(e?.message ?? e ?? 'No se pudo cargar el calendario'));
    } finally {
      setEventsLoading(false);
    }
  };

  const loadGrupos = async () => {
    if (!settings.apiBaseUrl?.trim()) return;
    try {
      setLoading(true);
      const res = await apiRequest<any[]>(settings.apiBaseUrl, '/comunidad/grupos');
      setGrupos(
        (Array.isArray(res) ? res : []).map((g: any) => ({
          id: Number(g.id),
          nombreGrupo: String(g.nombreGrupo ?? g.nombre_grupo ?? 'Grupo'),
          descripcion: g.descripcion != null ? String(g.descripcion) : undefined,
          participantes: g.participantes != null ? Number(g.participantes) : undefined,
        }))
      );
    } catch (e: any) {
      Alert.alert('No se pudo cargar comunidad', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  const loadMensajes = async (id: number) => {
    try {
      setLoading(true);
      const res = await apiRequest<any[]>(settings.apiBaseUrl, `/comunidad/grupos/${id}/mensajes`);
      setMensajes(
        (Array.isArray(res) ? res : []).map((m: any) => ({
          id: Number(m.id),
          autor: m.autor != null ? String(m.autor) : undefined,
          autorId: m.autorId != null ? Number(m.autorId) : undefined,
          texto: String(m.texto ?? ''),
          hora: m.hora != null ? String(m.hora) : undefined,
        }))
      );
    } catch (e: any) {
      Alert.alert('No se pudieron cargar mensajes', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGrupos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.apiBaseUrl]);

  useEffect(() => {
    void loadEvents();
    void loadEventReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.eventsCalendarIcsUrl]);

  useEffect(() => {
    if (grupoId) void loadMensajes(grupoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId]);

  const tryConsumePendingInvite = async () => {
    try {
      const pending = await getJson<{ token: string }>(STORAGE_KEYS.pendingInvite);
      const token = pending?.token ? String(pending.token).trim() : '';
      if (!token) return;

      await remove(STORAGE_KEYS.pendingInvite);

      const res = await apiRequest<any>(settings.apiBaseUrl, '/comunidad/invite/join', {
        method: 'POST',
        body: JSON.stringify({ token }),
        timeoutMs: 15000,
      });
      const gid = res?.groupId != null ? Number(res.groupId) : null;
      if (gid != null) {
        setJoined((p) => ({ ...p, [gid]: true }));
        await loadGrupos();
        setGrupoId(gid);
        Alert.alert('Comunidad', `Te uniste al grupo: ${String(res?.nombreGrupo ?? 'Grupo')}`);
      }
    } catch (e: any) {
      Alert.alert('Invitación', String(e?.message ?? e ?? 'No se pudo procesar la invitación'));
    }
  };

  useEffect(() => {
    void tryConsumePendingInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.apiBaseUrl]);

  const enviar = async () => {
    if (!grupoId) return;
    if (status !== 'signedIn') {
      Alert.alert('Inicia sesión', 'El chat requiere una cuenta.');
      return;
    }
    const msg = texto.trim();
    if (!msg) return;
    try {
      setLoading(true);
      const autorId = requireUserId();
      const autorNombre = user?.nombre ?? 'Usuario';
      await apiRequest(
        settings.apiBaseUrl,
        `/comunidad/grupos/${grupoId}/mensajes${toQuery({ autorNombre, autorId, texto: msg })}`,
        { method: 'POST' }
      );
      setTexto('');
      await loadMensajes(grupoId);
    } catch (e: any) {
      Alert.alert('No se pudo enviar', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  const openInvite = async (g: Grupo) => {
    try {
      setInvitePreparing(true);
      setInviteGroup(g);
      setInvitePhone('');
      setInviteCode('');
      setInviteMsg('');
      setInviteVisible(true);
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      await AsyncStorage.setItem(`grupo_codigo_${g.id}`, codigo);
      await apiRequest(settings.apiBaseUrl, `/comunidad/grupos/${g.id}/codigo`, {
        method: 'PUT',
        body: JSON.stringify({ codigo }),
        timeoutMs: 15000,
      });
      const nombreGrupo = String(g.nombreGrupo ?? 'Grupo');
      const mensaje =
        `👋 ¡Hola! Te invito a unirte a mi grupo "${nombreGrupo}" ` +
        `en SENDA VIDA 🌿\n\n` +
        `📱 Descarga SENDA VIDA\n` +
        `🔑 Usa este código: *${codigo}*\n\n` +
        `Ve a Comunidad → "Unirse con código" e ingresa el código.`;
      setInviteCode(codigo);
      setInviteMsg(mensaje);
    } catch (error: unknown) {
      Alert.alert('Invitar', toMensajeError(error, 'No se pudo generar el código de invitación.'));
      setInviteVisible(false);
      setInviteGroup(null);
    } finally {
      setInvitePreparing(false);
    }
  };

  const closeInvite = () => {
    setInviteVisible(false);
    setInviteGroup(null);
    setInviteCode('');
  };

  const sendSmsInvite = async () => {
    const phone = invitePhone.trim().replace(/\s+/g, '');
    if (!phone) return Alert.alert('Invitar', 'Escribe un número de celular.');
    const body = encodeURIComponent(inviteMsg.trim());

    // iOS usa &body cuando ya hay destinatario; Android suele usar ?body
    const url = Platform.OS === 'ios' ? `sms:${phone}&body=${body}` : `sms:${phone}?body=${body}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) return Alert.alert('SMS', 'No se pudo abrir la app de mensajes.');
      await Linking.openURL(url);
      closeInvite();
    } catch (error: unknown) {
      Alert.alert('SMS', toMensajeError(error, 'No se pudo enviar el SMS.'));
    }
  };

  const shareInvite = async () => {
    try {
      await Share.share({ message: inviteMsg.trim() });
      closeInvite();
    } catch (error: unknown) {
      Alert.alert('Compartir', toMensajeError(error, 'No se pudo compartir.'));
    }
  };

  const sendWhatsAppInvite = async () => {
    const mensaje = inviteMsg.trim();
    if (!mensaje) {
      Alert.alert('WhatsApp', 'Primero genera un código de invitación válido.');
      return;
    }
    try {
      await Linking.openURL('https://wa.me/?text=' + encodeURIComponent(mensaje));
      closeInvite();
    } catch {
      Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp.');
    }
  };

  const joinWithCode = async () => {
    const codigo = joinCode.trim().toUpperCase();
    if (!codigo) {
      Alert.alert('Unirse con código', 'Pega un código válido.');
      return;
    }
    try {
      setJoiningByCode(true);
      const grupo = await apiRequest<GrupoCodigoLookup>(settings.apiBaseUrl, `/grupos/codigo/${encodeURIComponent(codigo)}`, {
        method: 'GET',
        timeoutMs: 15000,
      });
      const groupId = Number(grupo?.id ?? grupo?.groupId);
      if (!Number.isFinite(groupId)) {
        Alert.alert('Unirse con código', 'Código inválido o expirado.');
        return;
      }
      await apiRequest(settings.apiBaseUrl, `/comunidad/grupos/${groupId}/unirse`, {
        method: 'PUT',
        timeoutMs: 15000,
      });
      setJoined((prev) => ({ ...prev, [groupId]: true }));
      setGrupoId(groupId);
      setJoinCode('');
      await loadGrupos();
      Alert.alert('Comunidad', `Te uniste al grupo: ${String(grupo?.nombreGrupo ?? 'Grupo')}`);
      return;
    } catch (error: unknown) {
      const status =
        error && typeof error === 'object' && 'status' in error && typeof (error as { status: unknown }).status === 'number'
          ? (error as { status: number }).status
          : -1;
      if (status === 404) {
        Alert.alert('Unirse con código', 'Código inválido o expirado.');
      } else {
        Alert.alert('Unirse con código', toMensajeError(error, 'No se pudo validar el código de invitación.'));
      }
    } finally {
      setJoiningByCode(false);
    }
  };

  const openContactsPicker = async () => {
    try {
      setContactsError(null);
      setContactsVisible(true);
      setContactsQuery('');
      setContactsLoading(true);
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a contactos.');
        setContactsError('Permiso de contactos denegado.');
        setContactsList([]);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      const contactosOrdenados: ContactoInvitable[] = data
        .filter((c) => {
          const nombre = (c.name || c.firstName || c.lastName || '').trim();
          return nombre.trim().length > 0 && c.phoneNumbers && c.phoneNumbers.length > 0;
        })
        .map((c) => ({
          id: String(c.id),
          nombre: (c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre').trim(),
          numero: normalizarNumero(String(c.phoneNumbers?.[0]?.number ?? '')),
        }))
        .filter((c) => c.numero.trim().length > 0)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      setContactsList(contactosOrdenados);
    } catch (error: unknown) {
      setContactsError(toMensajeError(error, 'No se pudieron cargar contactos.'));
      setContactsList([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const openCreate = () => {
    setCreateName('');
    setCreateDesc('');
    setCreateVisible(true);
  };

  const closeCreate = () => setCreateVisible(false);

  const crearGrupo = async () => {
    const nombre = createName.trim();
    const descripcion = createDesc.trim();
    if (!nombre) return Alert.alert('Crear grupo', 'Escribe un nombre.');
    try {
      setLoading(true);
      await apiRequest(settings.apiBaseUrl, '/comunidad/grupos', {
        method: 'POST',
        body: JSON.stringify({ nombre, descripcion }),
      });
      closeCreate();
      await loadGrupos();
    } catch (e: any) {
      const msg = e?.message ?? 'No se pudo crear.';
      const hint = msg.toLowerCase().includes('connect') || msg.toLowerCase().includes('timeout')
        ? ' Verifica que el backend esté corriendo en el puerto 8084 y que la URL en Ajustes sea correcta.'
        : '';
      Alert.alert('Crear grupo', msg + hint);
    } finally {
      setLoading(false);
    }
  };

  const unirseGrupo = async (g: Grupo) => {
    if (joined[g.id]) return;
    try {
      setLoading(true);
      await apiRequest(settings.apiBaseUrl, `/comunidad/grupos/${g.id}/unirse`, { method: 'PUT' });
      setJoined((p) => ({ ...p, [g.id]: true }));
      await loadGrupos();
    } catch (e: any) {
      Alert.alert('Unirse', e?.message ?? 'No se pudo unir.');
    } finally {
      setLoading(false);
    }
  };

  const pickContact = (c: ContactoInvitable) => {
    const phone = c.numero ? String(c.numero) : '';
    if (!phone) return;
    setInvitePhone(phone);
    setContactsVisible(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen scroll>
        <Modal visible={createVisible} transparent animationType="fade" onRequestClose={closeCreate}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Crear grupo</Text>

              <TextInput
                value={createName}
                onChangeText={setCreateName}
                placeholder="Nombre del grupo"
                placeholderTextColor={colors.muted}
                style={styles.modalInput}
              />
              <TextInput
                value={createDesc}
                onChangeText={setCreateDesc}
                placeholder="Descripción (opcional)"
                placeholderTextColor={colors.muted}
                multiline
                style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
              />

              <View style={styles.modalBtnsRow}>
                <Pressable onPress={crearGrupo} style={[styles.modalBtn, { backgroundColor: colors.primary }]} accessibilityRole="button">
                  <Text style={styles.modalBtnText}>{loading ? 'Creando…' : 'Crear'}</Text>
                </Pressable>
                <Pressable onPress={closeCreate} style={[styles.modalBtn, { backgroundColor: '#111827' }]} accessibilityRole="button">
                  <Text style={styles.modalBtnText}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={inviteVisible} transparent animationType="fade" onRequestClose={closeInvite}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Invitar miembros</Text>
              <Text style={styles.modalSub}>{inviteGroup ? inviteGroup.nombreGrupo : 'Grupo'}</Text>

              <TextInput
                value={invitePhone}
                onChangeText={setInvitePhone}
                placeholder="Número de celular (ej: 7XXXXXXX)"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={styles.modalInput}
              />

              <Pressable
                onPress={() => void openContactsPicker()}
                style={[styles.modalBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                accessibilityRole="button"
              >
                <Text style={[styles.moreText, { textAlign: 'center' }]}>Elegir contacto</Text>
              </Pressable>

              {inviteCode ? (
                <Pressable
                  onPress={() => {
                    void Clipboard.setStringAsync(inviteCode);
                    Alert.alert('Código', 'Copiado al portapapeles.');
                  }}
                  style={[styles.modalBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.moreText, { textAlign: 'center', color: colors.primary }]}>Copiar código</Text>
                </Pressable>
              ) : null}

              {invitePreparing ? (
                <View style={{ paddingVertical: 8 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <TextInput
                  value={inviteMsg}
                  onChangeText={setInviteMsg}
                  placeholder="Mensaje de invitación"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={[styles.modalInput, { minHeight: 90, textAlignVertical: 'top' }]}
                />
              )}

              <View style={styles.modalBtnsRow}>
                <Pressable
                  onPress={sendSmsInvite}
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  disabled={invitePreparing}
                >
                  <Text style={styles.modalBtnText}>Enviar SMS</Text>
                </Pressable>
                <Pressable
                  onPress={() => void sendWhatsAppInvite()}
                  style={[styles.modalBtn, { backgroundColor: '#111827' }]}
                  accessibilityRole="button"
                  disabled={invitePreparing}
                >
                  <Text style={styles.modalBtnText}>WhatsApp</Text>
                </Pressable>
              </View>
              <Pressable onPress={shareInvite} style={styles.modalCancel} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Compartir por otras apps</Text>
              </Pressable>

              <Pressable onPress={closeInvite} style={styles.modalCancel} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={contactsVisible} transparent animationType="fade" onRequestClose={() => setContactsVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Contactos</Text>
              <TextInput
                value={contactsQuery}
                onChangeText={setContactsQuery}
                placeholder="Buscar…"
                placeholderTextColor={colors.muted}
                style={styles.modalInput}
              />

              {contactsError ? <Text style={styles.note}>{contactsError}</Text> : null}
              {contactsLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}

              <View style={{ gap: 10, maxHeight: 320 }}>
                {contactsList
                  .filter((c) => {
                    const q = contactsQuery.trim().toLowerCase();
                    if (!q) return true;
                    return String(c.nombre ?? '').toLowerCase().includes(q);
                  })
                  .slice(0, 25)
                  .map((c, idx) => (
                    <Pressable
                      key={c.id}
                      onPress={() => pickContact(c)}
                      style={[styles.groupItem, { borderRadius: 14 }]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.groupIcon}>📇</Text>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.groupName}>{c.nombre ?? 'Sin nombre'}</Text>
                        <Text style={styles.groupDesc}>{c.numero ?? '—'}</Text>
                      </View>
                    </Pressable>
                  ))}
              </View>

              <Pressable onPress={() => setContactsVisible(false)} style={styles.modalCancel} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (navigation.canGoBack?.()) navigation.goBack();
              else navigation.dispatch?.(DrawerActions.openDrawer());
            }}
            style={styles.backBtn}
            accessibilityRole="button"
          >
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.h1}>🌐 Comunidad</Text>
          <View style={{ width: 44 }} />
        </View>

        <Card style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.cardTitle}>Grupos locales</Text>
            <Pressable onPress={openCreate} style={styles.morePill} accessibilityRole="button" accessibilityLabel="Crear grupo">
              <Text style={styles.moreText}>+ Crear</Text>
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            {grupos.map((g) => (
              <View key={g.id} style={styles.groupRow}>
                <Pressable
                  onPress={() => setGrupoId(g.id)}
                  style={[styles.groupItem, grupoId === g.id && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                >
                  <Text style={styles.groupIcon}>👥</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.groupName}>{g.nombreGrupo}</Text>
                    <Text style={styles.groupDesc}>{g.participantes != null ? `${g.participantes} miembros` : '— miembros'}</Text>
                  </View>
                </Pressable>

                <Pressable onPress={() => openInvite(g)} style={styles.morePill} accessibilityRole="button" accessibilityLabel="Invitar">
                  <Text style={styles.moreText}>Más</Text>
                </Pressable>
                <Pressable
                  onPress={() => void unirseGrupo(g)}
                  style={[styles.joinPill, joined[g.id] && { backgroundColor: colors.primarySoft }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.joinText, joined[g.id] && { color: colors.primary }]}>{joined[g.id] ? 'Unido' : 'Unirse'}</Text>
                </Pressable>
              </View>
            ))}
            {!grupos.length ? <Text style={styles.note}>{loading ? 'Cargando…' : 'Sin grupos disponibles.'}</Text> : null}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Comunidad</Text>
          <Pressable
            onPress={() => setJoinCodeVisible((prev) => !prev)}
            style={[styles.modalBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            disabled={joiningByCode}
          >
            <Text style={styles.modalBtnText}>🔑 Unirse con código</Text>
          </Pressable>
          {joinCodeVisible ? (
            <>
              <TextInput
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="Pega el código recibido"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                style={styles.modalInput}
              />
              {joiningByCode ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              <Pressable
                onPress={() => void joinWithCode()}
                style={[styles.modalBtn, { backgroundColor: '#111827' }]}
                accessibilityRole="button"
                disabled={joiningByCode}
              >
                <Text style={styles.modalBtnText}>{joiningByCode ? 'Validando…' : 'Confirmar código'}</Text>
              </Pressable>
            </>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Próximos eventos</Text>
          <View style={{ gap: 8 }}>
            {!settings.eventsCalendarIcsUrl?.trim() ? (
              <Text style={styles.note}>Configura un link iCal (.ics) en Ajustes para ver eventos.</Text>
            ) : null}

            {eventsError ? <Text style={styles.note}>Error: {eventsError}</Text> : null}
            {eventsLoading ? <Text style={styles.note}>Cargando eventos…</Text> : null}

            {events.map((e) => {
              const reminder = eventReminders[e.id];
              const when = e.startDate.toLocaleString();
              return (
                <View key={e.id} style={styles.eventRow}>
                  <Text style={styles.eventIcon}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventName}>{e.title}</Text>
                    <Text style={styles.eventSub}>
                      {when}
                      {e.location ? ` • ${e.location}` : ''}
                    </Text>
                  </View>

                  <Pressable
                    onPress={async () => {
                      try {
                        if (reminder) {
                          await cancelEventReminder(e.id);
                          await loadEventReminders();
                          return;
                        }
                        await scheduleEventReminder({ event: e, minutesBefore: 30 });
                        await loadEventReminders();
                      } catch (err: any) {
                        Alert.alert('Recordatorio', String(err?.message ?? err ?? 'No se pudo programar'));
                      }
                    }}
                    style={[styles.joinPill, reminder && { backgroundColor: colors.primarySoft }]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.joinText, reminder && { color: colors.primary }]}>
                      {reminder ? 'Quitar' : 'Recordar'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}

            {settings.eventsCalendarIcsUrl?.trim() && !eventsLoading && !events.length && !eventsError ? (
              <Text style={styles.note}>No hay eventos próximos.</Text>
            ) : null}
          </View>
        </Card>

        <LargeButton
          title="💬 Abrir chat comunitario"
          onPress={() => {
            const first = grupos[0];
            if (!first) return Alert.alert('Chat', 'No hay grupos disponibles.');
            setGrupoId(first.id);
          }}
          variant="primary"
        />

        {grupoId ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Chat</Text>
            <View style={{ gap: 10 }}>
              {mensajes.slice(-20).map((m) => {
                const mine = status === 'signedIn' && m.autorId != null && m.autorId === user?.userId;
                return (
                  <View key={m.id} style={[styles.msg, mine ? styles.msgMine : styles.msgOther]}>
                    <Text style={styles.msgAuthor}>{m.autor ?? '—'}</Text>
                    <Text style={styles.msgText}>{m.texto}</Text>
                  </View>
                );
              })}
              {!mensajes.length ? <Text style={styles.note}>{loading ? 'Cargando…' : 'Sin mensajes.'}</Text> : null}
            </View>

            <View style={styles.composer}>
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="Escribe un mensaje…"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Pressable
                onPress={enviar}
                style={[styles.sendBtn, (!texto.trim() || loading) && { opacity: 0.6 }]}
                disabled={!texto.trim() || loading}
                accessibilityRole="button"
              >
                <Text style={styles.sendText}>Enviar</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}
      </Screen>

      <Pressable
        onPress={async () => {
          const url = INSTAGRAM_PROFILE_URL;
          const ua = (globalThis as any)?.navigator?.userAgent ? String((globalThis as any).navigator.userAgent) : '';
          const isMobile = /iPhone|iPad|Android/i.test(ua) || Platform.OS !== 'web';

          if (isMobile) {
            try {
              await Linking.openURL('instagram://user?username=cicla28_');
            } catch {
              // ignore: fallback below
            }
            setTimeout(() => {
              void Linking.openURL(url).catch(() => {});
            }, 1500);
            return;
          }

          await Linking.openURL(url);
        }}
        style={styles.igBtn}
        accessibilityRole="button"
        accessibilityLabel="Abrir Instagram @cicla28_"
      >
        <Text style={styles.igIcon}>Instagram</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily },
  h1: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 4, fontFamily },

  card: { gap: 12 },
  cardTitle: { color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },
  note: { color: colors.muted, fontWeight: '700', fontFamily },

  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  groupIcon: { fontSize: 18 },
  groupName: { color: colors.text, fontWeight: '900', fontFamily },
  groupDesc: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 12 },
  joinPill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  joinText: { color: colors.primary, fontWeight: '900', fontFamily },
  morePill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  moreText: { color: colors.text, fontWeight: '900', fontFamily },

  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  eventIcon: { fontSize: 18 },
  eventName: { color: colors.text, fontWeight: '900', fontFamily },
  eventSub: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 12 },

  msg: { borderRadius: 14, padding: 10, gap: 2, borderWidth: 1 },
  msgMine: { alignSelf: 'flex-end', backgroundColor: colors.primarySoft, borderColor: colors.primary },
  msgOther: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border },
  msgAuthor: { color: colors.muted, fontWeight: '800', fontSize: 12, fontFamily },
  msgText: { color: colors.text, fontWeight: '700', fontFamily },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  input: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily, color: colors.text },
  sendBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primary },
  sendText: { color: 'white', fontWeight: '900', fontFamily },

  igBtn: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    width: 72,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#C13584',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  igIcon: { color: 'white', fontWeight: '900', fontFamily, fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 460, borderRadius: 18, backgroundColor: colors.surface, padding: 16, gap: 10 },
  modalTitle: { color: colors.text, fontWeight: '900', fontFamily, fontSize: 16, textAlign: 'center' },
  modalSub: { color: colors.muted, fontWeight: '800', fontFamily, textAlign: 'center' },
  modalInput: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily, color: colors.text, fontWeight: '700', backgroundColor: colors.surface },
  modalBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: 'white', fontWeight: '900', fontFamily },
  modalCancel: { paddingVertical: 10, alignItems: 'center' },
  modalCancelText: { color: colors.muted, fontWeight: '900', fontFamily },
});

