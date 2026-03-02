import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { AppStackParamList } from '../../types/navigation';

export function RoutesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  return (
    <Screen>
      <PrimaryButton title="Ver rutas seguras" onPress={() => navigation.navigate('SafeRoutes')} />
    </Screen>
  );
}

