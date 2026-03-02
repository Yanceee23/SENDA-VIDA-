# Expo Go: “java.io.IOException failed to download remote update”

Este error casi siempre significa que **Expo Go no puede alcanzar tu PC** para descargar el bundle de Metro.

## Checklist rápido (lo más común)

- **Misma red Wi‑Fi**: el teléfono y la PC deben estar en la misma red.
- **VPN/Proxy**: apágalo temporalmente (en PC y teléfono).
- **Firewall de Windows**: permite `node.exe`/`expo` en redes privadas.
- **Reinicia Metro** y limpia caché.

## Comandos recomendados

Desde la carpeta `MOVIL`:

```bash
npm run start:clear
```

Si sigue fallando en modo LAN, usa **Tunnel** (evita problemas de IP/firewall):

```bash
npm run start:tunnel
```

## Si el QR abre pero se queda cargando

- Cierra Expo Go completamente y ábrelo de nuevo.
- En Expo Go: “Recently opened” → elimina el proyecto viejo y vuelve a escanear.

## Nota sobre mapas (importante)

`react-native-maps` **no funciona dentro de Expo Go**. Si necesitas el mapa nativo en esa pantalla, la solución correcta es usar **Dev Client** (build).

