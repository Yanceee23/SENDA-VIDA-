# SENDA VIDA

App de ciclismo con rutas, comunidad, hidratación y más.

## Requisitos previos

- **Java 17** (backend)
- **Node.js 18+** y **npm** (móvil)
- **PostgreSQL** (puerto 5433 por defecto)
- **Expo Go** en el celular (opcional, para desarrollo)

## 1. Clonar el repositorio

```bash
git clone https://github.com/Yanceee23/SENDA-VIDA-.git
cd SENDA-VIDA-
```

## 2. Configurar PostgreSQL

Crea la base de datos antes de ejecutar el backend:

```sql
CREATE DATABASE senda_vida;
```

El backend usa por defecto:
- **Host:** configurado por entorno
- **Puerto:** 5433
- **Base de datos:** senda_vida
- **Usuario:** postgres
- **Contraseña:** admin123

## 3. Ejecutar el Backend

```bash
cd BACKEND
.\mvnw.cmd spring-boot:run
```

En Linux/Mac:

```bash
./mvnw spring-boot:run
```

El backend corre en **https://senda-vida.onrender.com/api**

Verifica que funciona: abre https://senda-vida.onrender.com/api/health en el navegador (debe devolver `{"ok":true}`).

## 4. Configurar y ejecutar la app móvil

En **otra terminal**:

```bash
cd MOVIL
cp .env.example .env
```

Edita el archivo `.env` con tus valores:

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | URL del backend. Usa siempre `https://senda-vida.onrender.com/api` para mantener autenticación y acceso a rutas. |
| `EXPO_PUBLIC_GBIF_SEARCH_RADIUS_KM` | Radio (km) para filtrar especies GBIF alrededor del GPS actual. Valor por defecto: `2`. |
| `EXPO_PUBLIC_GEMINI_API_KEY` | API Key de Gemini (consíguela gratis en https://aistudio.google.com) |

Luego instala dependencias e inicia:

```bash
npm install
npm start
```

Escanea el código QR con Expo Go en tu celular para probar la app.

## Producción (Render + APK)

Para desplegar el backend en Render y generar una APK que se conecte por HTTPS:

### Paso 1: Conectar el repo a Render

1. Entra en [dashboard.render.com](https://dashboard.render.com)
2. **New** → **Blueprint**
3. Conecta tu repositorio de GitHub (el que contiene `render.yaml`)
4. Render desplegará automáticamente PostgreSQL y el backend Spring Boot

La API quedará disponible en **https://senda-vida.onrender.com/api**

### Paso 2: Generar la APK

Ejecuta el script desde la carpeta del proyecto:

```powershell
cd MOVIL
.\build-apk.ps1
```

El script instala dependencias y lanza el build en EAS Cloud. Cuando termine, descarga la APK desde [expo.dev](https://expo.dev). La app se conectará a `https://senda-vida.onrender.com/api`.

**Importante:** Ejecuta siempre desde `MOVIL` (donde está `app.json` y `package.json`). Si ejecutas `eas build` desde la raíz del repo, el build puede fallar.

### Rutas en BD versus lugares naturales (Playas, volcanes…)

Las **rutas** que vienen de tu base de datos se cargan con la URL configurada (`EXPO_PUBLIC_API_BASE_URL`, p. ej. Render): `GET /api/rutas` o por tipo.

Los **lugares naturales** en la pantalla Rutas Seguras (playas, volcanes, cascadas, ríos/lagos cuando aplica, etc.) usan **`GET /api/geo/ecolugares`** cuando la API está configurada. Ese endpoint consulta OpenStreetMap (Overpass) **desde el servidor** (Render), con caché. Si esa petición falla, la app hace **respaldo** llamando directamente a instancias públicas de Overpass desde el teléfono.

**Diagnóstico rápido:** Si fallan solo los “lugares” pero `https://<tu-host>/api/health` responde bien, el problema no es tanto “Render caído” como **Overpass o la red hacia ese servicio**. Comprueba logs del backend (`EcoPlaces`) y conectividad desde el mismo dispositivo/red.

---

## Notas opcionales

- **Firebase:** El backend usa Firebase para notificaciones push. Si no tienes `firebase-service-account.json` en `BACKEND/src/main/resources/`, el backend sigue funcionando pero sin FCM.
- **Puerto del backend:** Puedes cambiar el puerto con la variable de entorno `PORT` (ej: `PORT=8080 .\mvnw.cmd spring-boot:run`).
