import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { DrawerParamList } from '../types/navigation';
import { MainTabs } from './MainTabs';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { colors } from '../theme/colors';

const Drawer = createDrawerNavigator<DrawerParamList>();

export function DrawerRoot() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.muted,
        drawerStyle: { backgroundColor: colors.surface },
      }}
    >
      <Drawer.Screen name="Tabs" component={MainTabs} options={{ title: 'Inicio' }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notificaciones' }} />
    </Drawer.Navigator>
  );
}

