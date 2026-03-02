import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../types/navigation';
import { DashboardScreen } from '../screens/tabs/DashboardScreen';
import { WeatherAlertsScreen } from '../screens/WeatherAlertsScreen';
import { SafeRoutesScreen } from '../screens/SafeRoutesScreen';
import { ActiveRouteScreen } from '../screens/ActiveRouteScreen';
import { RouteFinishedScreen } from '../screens/RouteFinishedScreen';
import { EnvironmentalInfoScreen } from '../screens/EnvironmentalInfoScreen';
import { EcoChallengesScreen } from '../screens/EcoChallengesScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NavigateToPlaceScreen } from '../screens/NavigateToPlaceScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="WeatherAlerts" component={WeatherAlertsScreen} />
      <Stack.Screen name="SafeRoutes" component={SafeRoutesScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ActiveRoute" component={ActiveRouteScreen} />
      <Stack.Screen name="RouteFinished" component={RouteFinishedScreen} />
      <Stack.Screen name="EnvironmentalInfo" component={EnvironmentalInfoScreen} />
      <Stack.Screen name="EcoChallenges" component={EcoChallengesScreen} />
      <Stack.Screen name="NavigateToPlace" component={NavigateToPlaceScreen} />
    </Stack.Navigator>
  );
}

