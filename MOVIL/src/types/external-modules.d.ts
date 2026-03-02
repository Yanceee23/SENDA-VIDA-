declare module '@react-navigation/native' {
  export type ParamListBase = Record<string, object | undefined>;

  export const NavigationContainer: any;
  export const DefaultTheme: Theme;

  export function useNavigation<T = any>(): T;
  export function useRoute<T = any>(): T;
  export function useFocusEffect(effect: any): void;

  export const DrawerActions: any;

  export interface Theme {
    dark: boolean;
    colors: any;
  }
}

declare module '@react-navigation/native-stack' {
  import type { ParamListBase } from '@react-navigation/native';

  export type NativeStackNavigationProp<ParamList extends ParamListBase = ParamListBase> = any;
  export type NativeStackScreenProps<
    ParamList extends ParamListBase = ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList
  > = any;

  export function createNativeStackNavigator<ParamList extends ParamListBase = ParamListBase>(): any;
}

declare module '@react-navigation/bottom-tabs' {
  import type { ParamListBase } from '@react-navigation/native';
  export function createBottomTabNavigator<ParamList extends ParamListBase = ParamListBase>(): any;
}

declare module '@react-navigation/drawer' {
  import type { ParamListBase } from '@react-navigation/native';
  export function createDrawerNavigator<ParamList extends ParamListBase = ParamListBase>(): any;
}

