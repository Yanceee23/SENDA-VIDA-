## Emulador Android + backend local

`.env` en `MOVIL/` (no se sube a git):

```
EXPO_PUBLIC_API_BASE_URL=https://senda-vida.onrender.com/api
```

Usa la API pública en Render para evitar problemas de conectividad y autenticación.

### Herramientas

- Android Studio: SDK Platform, Build-Tools, Platform-Tools, un AVD.

### adb en PowerShell (sesión actual)

Desde `MOVIL`:

```powershell
.\scripts\android-env.ps1
```

Si el SDK está raro, ajusta rutas dentro del script o define `ANDROID_SDK_ROOT`.

### Levantar app con emulador ya abierto

```powershell
.\scripts\run-android.ps1
```

O a mano (mismo PATH que arriba):

```powershell
npx expo start --android
```

**Cachés:** Expo/Metro viven fuera del repo (`node_modules/.cache`, `.expo`). Si algo huele raro: `npm run start:clear` en `MOVIL`.
