# Dev Client (Android) — SENDA VIDA

Esto es lo que necesitas para que el **mapa nativo** y otros módulos nativos funcionen (porque **Expo Go** no los trae).

## Opción A (rápida/local): `expo run:android`

Requisitos:
- Android Studio + SDK instalado
- Un emulador o un teléfono con **Depuración USB** activa

En `MOVIL`:

```bash
npm run start:clear
```

En otra terminal:

```bash
npm run run:android
```

Luego abre la app instalada (Dev Client). Para conectar con Metro:

```bash
npm run start:dev
```

## Opción B (recomendada para instalar en tu teléfono): EAS Build

1) Instala EAS CLI:

```bash
npm i -g eas-cli
```

2) Login:

```bash
eas login
```

3) Genera el Dev Client (APK/AAB interno):

```bash
eas build -p android --profile development
```

4) Instala el build en tu teléfono (EAS te da un link/QR).

5) Arranca Metro en modo Dev Client:

```bash
npm run start:dev
```

## Importante (sobre el error de “remote update”)

Si tu teléfono no llega a tu PC por LAN, arranca con tunnel:

```bash
npm run start:tunnel
```

