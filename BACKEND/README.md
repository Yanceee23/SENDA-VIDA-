# BACKEND (Spring Boot)

## URL base

- **Base**: `http://<IP_DE_TU_PC>:8084/api`
- **Health**: `GET /api/health`

En tu caso (Wi‑Fi): `http://192.168.1.123:8084/api`.

## Ejecutar

```bash
cd BACKEND
./mvnw.cmd spring-boot:run
```

Si quieres cambiar el puerto:

```bash
set PORT=8083
./mvnw.cmd spring-boot:run
```

## Expo Go (Android físico): notas importantes

- **No uses** `10.0.2.2` en el celular real (eso es solo para emulador Android).
- Si desde el celular no abre `http://192.168.1.123:8084/api/health`, casi siempre es **Windows Firewall**.

### Windows Firewall

Permite conexiones entrantes al puerto del backend (ej. 8084):

- Abrir *Windows Defender Firewall con seguridad avanzada*
- *Reglas de entrada* → *Nueva regla…*
- **Puerto** → **TCP** → **Puertos locales específicos**: `8084`
- **Permitir la conexión**
- Aplicar a *Privado* (y *Dominio* si aplica)

