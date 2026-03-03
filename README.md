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
- **Host:** localhost
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

El backend corre en **http://localhost:8084/api**

Verifica que funciona: abre http://localhost:8084/api/health en el navegador (debe devolver `{"ok":true}`).

## 4. Configurar y ejecutar la app móvil

En **otra terminal**:

```bash
cd MOVIL
cp .env.example .env
```

Edita el archivo `.env` con tus valores:

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | URL del backend. En celular físico: IP de tu PC en la misma Wi-Fi (ej: `http://192.168.1.100:8084/api`). En emulador Android: `http://10.0.2.2:8084/api` |
| `EXPO_PUBLIC_GEMINI_API_KEY` | API Key de Gemini (consíguela gratis en https://aistudio.google.com) |

Luego instala dependencias e inicia:

```bash
npm install
npm start
```

Escanea el código QR con Expo Go en tu celular para probar la app.

## Notas opcionales

- **Firebase:** El backend usa Firebase para notificaciones push. Si no tienes `firebase-service-account.json` en `BACKEND/src/main/resources/`, el backend sigue funcionando pero sin FCM.
- **Puerto del backend:** Puedes cambiar el puerto con la variable de entorno `PORT` (ej: `PORT=8080 .\mvnw.cmd spring-boot:run`).
