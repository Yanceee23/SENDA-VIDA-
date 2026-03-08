import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Contacts from 'expo-contacts';
import {
  isBackendConfigured,
  getMensajes as getMensajesBackend,
  sendMessage as sendMessageBackend,
  subscribeToMessages as subscribeBackend,
  type ChatMessage,
} from '../../services/backendChatService';
import {
  isFirebaseConfigured,
  getMensajes as getMensajesFirebase,
  sendMessage as sendMessageFirebase,
  subscribeToMessages as subscribeFirebase,
} from '../../services/firebaseChatService';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../state/AuthContext';
import { useSettings } from '../../state/SettingsContext';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';

function formatHora(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
}

function getInviteUrl(): string {
  try {
    return Linking.createURL('/') || 'sendavida://';
  } catch {
    return 'sendavida://';
  }
}

export function CommunityScreen() {
  const navigation = useNavigation<any>();
  const { status, user } = useAuth();
  const { settings } = useSettings();
  const apiBaseUrl = settings.apiBaseUrl ?? '';

  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; number: string }>>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isMine = useCallback(
    (m: ChatMessage) => status === 'signedIn' && m.autorId === user?.userId,
    [status, user?.userId]
  );

  const chatAvailable = isBackendConfigured(apiBaseUrl) || isFirebaseConfigured();

  const loadMensajes = useCallback(async () => {
    setMensajes([]);
    if (isBackendConfigured(apiBaseUrl)) {
      getMensajesBackend(apiBaseUrl)
        .then((list) => setMensajes(list.sort((a, b) => a.timestamp - b.timestamp)))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (isFirebaseConfigured()) {
      getMensajesFirebase()
        .then((list) => setMensajes(list.sort((a, b) => a.timestamp - b.timestamp)))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useFocusEffect(
    useCallback(() => {
      if (!chatAvailable) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void loadMensajes();
    }, [chatAvailable, loadMensajes])
  );

  useEffect(() => {
    if (!chatAvailable) return;
    let unsub: (() => void) | null = null;
    if (isBackendConfigured(apiBaseUrl)) {
      unsub = subscribeBackend(apiBaseUrl, (msg) => {
        setMensajes((prev) => {
          if (prev.some((p) => p.id === msg.id)) return prev;
          return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
        });
      });
    } else if (isFirebaseConfigured()) {
      unsub = subscribeFirebase((msg) => {
        setMensajes((prev) => {
          if (prev.some((p) => p.id === msg.id)) return prev;
          return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
        });
      });
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [chatAvailable, apiBaseUrl]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || sending) return;
    if (status !== 'signedIn') {
      Alert.alert('Inicia sesión', 'El chat requiere una cuenta.');
      return;
    }
    if (isBackendConfigured(apiBaseUrl)) {
      try {
        setSending(true);
        await sendMessageBackend(apiBaseUrl, user?.nombre ?? 'Usuario', user?.userId ?? 0, msg);
        setTexto('');
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'No se pudo enviar.');
      } finally {
        setSending(false);
      }
      return;
    }
    if (isFirebaseConfigured()) {
      try {
        setSending(true);
        await sendMessageFirebase(user?.nombre ?? 'Usuario', user?.userId ?? 0, msg);
        setTexto('');
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'No se pudo enviar.');
      } finally {
        setSending(false);
      }
      return;
    }
    Alert.alert('Chat no disponible', 'Configura la URL del backend en Ajustes o Firebase en .env');
  };

  const shareInvite = async () => {
    const url = getInviteUrl();
    const message = `¡Únete a SENDA VIDA! App para rutas seguras y comunidad. Descarga: ${url}`;
    try {
      await Share.share({
        message,
        title: 'Invita a SENDA VIDA',
        url: Platform.OS !== 'web' ? url : undefined,
      });
    } catch {
      Alert.alert('Compartir', 'No se pudo abrir el menú de compartir.');
    }
  };

  const openContacts = async () => {
    try {
      setContactsLoading(true);
      setContactsModalVisible(true);
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso', 'Activa el acceso a contactos para invitar.');
        setContactsModalVisible(false);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      const list = data
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c) => {
          const num = String(c.phoneNumbers?.[0]?.number ?? '').replace(/\D/g, '');
          return {
            id: c.id,
            name: (c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre').trim(),
            number: num,
          };
        })
        .filter((c) => c.number.length > 0)
        .slice(0, 50);
      setContacts(list);
    } catch {
      Alert.alert('Contactos', 'No se pudieron cargar los contactos.');
      setContactsModalVisible(false);
    } finally {
      setContactsLoading(false);
    }
  };

  const shareToContact = (numero: string) => {
    const url = getInviteUrl();
    const msg = `¡Únete a SENDA VIDA! ${url}`;
    Linking.openURL(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`);
    setContactsModalVisible(false);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = isMine(item);
    return (
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        {!mine ? <Text style={styles.author}>{item.autor}</Text> : null}
        <Text style={styles.bubbleText}>{item.texto}</Text>
        <Text style={styles.time}>{formatHora(item.timestamp)}</Text>
      </View>
    );
  };

  if (!chatAvailable) {
    return (
      <View style={{ flex: 1 }}>
        <Screen>
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
            <Text style={styles.h1}>Comunidad</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.configHint}>
            <Text style={styles.configText}>
              Para usar el chat, configura la URL del backend en Ajustes → Conexión (API) o Firebase en .env.
            </Text>
          </View>
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        <Text style={styles.h1}>Comunidad</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => void shareInvite()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Compartir invitación">
            <Text style={styles.headerBtnText}>📤</Text>
          </Pressable>
          <Pressable onPress={() => void openContacts()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Invitar contactos">
            <Text style={styles.headerBtnText}>👥</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={mensajes}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.emptyText}>Sin mensajes aún. Escribe para empezar.</Text>
              )}
            </View>
          }
        />

        <View style={styles.composer}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={() => void enviar()}
            style={[styles.sendBtn, (!texto.trim() || sending) && styles.sendBtnDisabled]}
            disabled={!texto.trim() || sending}
            accessibilityRole="button"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendText}>Enviar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={contactsModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setContactsModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Invitar a un contacto</Text>
            {contactsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ padding: 20 }} />
            ) : contacts.length === 0 ? (
              <Text style={styles.modalText}>No hay contactos con número.</Text>
            ) : (
              <FlatList
                data={contacts}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => (
                  <Pressable style={styles.contactRow} onPress={() => shareToContact(item.number)}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.contactNumber}>{item.number}</Text>
                  </Pressable>
                )}
              />
            )}
            <Pressable onPress={() => setContactsModalVisible(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily },
  h1: { fontSize: 18, fontWeight: '900', color: colors.text, fontFamily },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { fontSize: 18 },
  chatWrap: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingBottom: 12 },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    gap: 2,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  author: { color: colors.primary, fontWeight: '800', fontSize: 12, fontFamily },
  bubbleText: { color: colors.text, fontWeight: '700', fontFamily, lineHeight: 20 },
  time: { color: colors.muted, fontWeight: '600', fontSize: 11, fontFamily, alignSelf: 'flex-end' },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: colors.muted, fontWeight: '700', fontFamily },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '900', fontFamily },
  configHint: { flex: 1, padding: 20, justifyContent: 'center' },
  configText: { color: colors.muted, fontWeight: '700', fontFamily, lineHeight: 22 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, maxHeight: '80%' },
  modalTitle: { color: colors.text, fontWeight: '900', fontFamily, fontSize: 16, marginBottom: 12 },
  modalText: { color: colors.muted, fontWeight: '700', fontFamily, padding: 12 },
  contactRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  contactName: { color: colors.text, fontWeight: '800', fontFamily },
  contactNumber: { color: colors.muted, fontWeight: '600', fontFamily, fontSize: 12 },
  modalCloseBtn: { marginTop: 12, padding: 12, alignItems: 'center' },
  modalCloseText: { color: colors.primary, fontWeight: '800', fontFamily },
});
