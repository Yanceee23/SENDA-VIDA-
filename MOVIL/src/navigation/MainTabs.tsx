import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme/colors';
import type { MainTabParamList } from '../types/navigation';
import { HomeStack } from './HomeStack';
import { RoutesStack } from './RoutesStack';
import { HydrationScreen } from '../screens/tabs/HydrationScreen';
import { CollageStack } from './CollageStack';
import { CommunityScreen } from '../screens/tabs/CommunityScreen';
import { useSettings } from '../state/SettingsContext';
import { scaleFont } from '../theme/scale';
import { fontFamily } from '../theme/typography';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { settings } = useSettings();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarLabelStyle: { fontSize: scaleFont(11, settings.fontScale), fontWeight: '800', fontFamily },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: '#eee',
        },
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeStack}
        options={{
          tabBarIcon: ({ color }: { color: string }) => (
            <Text style={{ color, fontSize: scaleFont(20, settings.fontScale) }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Rutas"
        component={RoutesStack}
        options={{
          tabBarIcon: ({ color }: { color: string }) => (
            <Text style={{ color, fontSize: scaleFont(20, settings.fontScale) }}>🗺️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Hidratacion"
        component={HydrationScreen}
        options={{
          title: 'Hidratación',
          tabBarLabel: 'Hidratación',
          tabBarIcon: ({ color }: { color: string }) => (
            <Text style={{ color, fontSize: scaleFont(20, settings.fontScale) }}>💧</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Collage"
        component={CollageStack}
        options={{
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Text style={{ color, fontSize: scaleFont(20, settings.fontScale), opacity: focused ? 1 : 0.9 }}>📷</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Comunidad"
        component={CommunityScreen}
        options={{
          tabBarIcon: ({ color }: { color: string }) => (
            <Text style={{ color, fontSize: scaleFont(20, settings.fontScale) }}>🌐</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

