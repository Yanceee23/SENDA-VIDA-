export type AuthStackParamList = {
  Welcome: undefined;
  Register: undefined;
  Login: undefined;
};

export type MainTabParamList = {
  Inicio: undefined;
  Rutas: undefined;
  Hidratacion: undefined;
  Collage: undefined;
  Comunidad: undefined;
};

export type CollageStackParamList = {
  CollageHome: undefined;
  CameraCapture: { lat: number; lng: number; actividadId?: number | null; rutaId?: number | null };
};

export type DrawerParamList = {
  Tabs: undefined;
  Profile: undefined;
  Settings: undefined;
  Notifications: undefined;
};

export type AppStackParamList = {
  Dashboard: undefined;
  SafeRoutes: undefined;
  Register: undefined;
  Login: undefined;
  ActiveRoute:
    | {
        tipo: 'ciclismo' | 'senderismo';
        rutaId?: number;
        rutaNombre?: string;
        saveToDb?: boolean;
        intensidad?: 'suave' | 'intensa';
        destLat?: number;
        destLng?: number;
        destNombre?: string;
        routeStartLat?: number;
        routeStartLng?: number;
        nivelSeguridad?: string;
      }
    | undefined;
  RouteFinished: {
    actividadId?: number;
    summary: { distanciaKm: number; calorias: number; tiempoSegundos: number; endLat: number; endLng: number; tipo: 'ciclismo' | 'senderismo' };
    autoOpenEnvironment?: boolean;
    routeAdvice?: string;
    nivelActual?: string;
    floraTotal?: number;
    faunaTotal?: number;
    floraNombres?: string[];
    faunaNombres?: string[];
  };
  EnvironmentalInfo: { lat: number; lng: number; nombre?: string; tipo?: string; useDeviceGps?: boolean; autoFetch?: boolean };
  EcoChallenges: { usuarioId?: number; rutaId?: number };
  WeatherAlerts: { lat: number; lng: number };
  NavigateToPlace: { destLat?: number; destLng?: number; destNombre?: string } | undefined;
};

