## Probar en emulador (Android Studio + Expo Go)

### 0) Configuración .env
Crea el archivo `.env` en `MOVIL/` (copia de `.env.example`) con la URL del backend para emulador:

```
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8084/api
```

`10.0.2.2` es el alias del host en el emulador Android (equivale a localhost de tu PC). Sin esto, la app pedirá configurar la URL manualmente en Ajustes.

### 1) Instala Android Studio + SDK
- En Android Studio abre **SDK Manager** e instala:
  - **Android SDK Platform** (una API estable, p. ej. 34/35)
  - **Android SDK Build-Tools**
  - **Android SDK Platform-Tools** (incluye `adb`)
  - **Android Emulator**

### 2) Crea y arranca un AVD
- En **Device Manager** crea un emulador (Pixel + API estable) y arráncalo.

### 3) Prepara `adb` en la terminal (solo esta sesión)
En `MOVIL/` ejecuta:

```powershell
.\scripts\android-env.ps1
```

Si tu SDK está en una ruta no estándar, edita la variable sugerida por el script (o configura `ANDROID_SDK_ROOT` en Windows).

### 4) Ejecuta Expo y abre en Android
Con el emulador abierto:

```powershell
.\scripts\run-android.ps1
```

Alternativa manual:

```powershell
$env:ANDROID_SDK_ROOT="RUTA_A_TU_SDK"
$env:ANDROID_HOME=$env:ANDROID_SDK_ROOT
$env:Path="$env:ANDROID_SDK_ROOT\platform-tools;$env:ANDROID_SDK_ROOT\emulator;$env:Path"
npx expo start --android
```

