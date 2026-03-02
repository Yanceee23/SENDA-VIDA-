import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../state/AuthContext';
import type { AuthStackParamList } from '../types/navigation';
import { SplashScreen } from '../screens/SplashScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { DrawerRoot } from './DrawerRoot';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export function AppNavigator() {
  const { status } = useAuth();

  if (status === 'loading') return <SplashScreen />;

  if (status === 'signedOut') {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
        <AuthStack.Screen name="Login" component={LoginScreen} />
      </AuthStack.Navigator>
    );
  }

  return <DrawerRoot />;
}

