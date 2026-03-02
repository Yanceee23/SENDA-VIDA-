import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CollageStackParamList } from '../types/navigation';
import { CollageScreen } from '../screens/tabs/CollageScreen';
import { CameraCaptureScreen } from '../screens/CameraCaptureScreen';

const Stack = createNativeStackNavigator<CollageStackParamList>();

export function CollageStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CollageHome" component={CollageScreen} />
      <Stack.Screen
        name="CameraCapture"
        component={CameraCaptureScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}

