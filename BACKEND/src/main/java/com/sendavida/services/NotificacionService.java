package com.sendavida.services;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service @Slf4j
public class NotificacionService {

    public void enviarNotificacion(String fcmToken, String titulo, String cuerpo) {
        if (fcmToken == null || fcmToken.isBlank()) {
            log.warn("FCM token vacío, no se envía notificación: {}", titulo);
            return;
        }
        if (FirebaseApp.getApps().isEmpty()) {
            log.warn("Firebase no inicializado; no se envía FCM: {}", titulo);
            return;
        }
        try {
            Message msg = Message.builder()
                .setToken(fcmToken)
                .setNotification(Notification.builder()
                    .setTitle(titulo).setBody(cuerpo).build())
                .build();
            String response = FirebaseMessaging.getInstance().send(msg);
            log.info(" FCM enviado: {} → {}", titulo, response);
        } catch (Exception e) {
            log.error(" Error FCM: {}", e.getMessage());
        }
    }

    public void notificarEmergencia(String telefono, String nombreUsuario, String ubicacion) {
        log.warn("🚨 EMERGENCIA — Usuario: {} — Ubicación: {} — Tel: {}", nombreUsuario, ubicacion, telefono);
        // Aquí podrías integrar SMS (Twilio) o WhatsApp si lo deseas
    }

    public void notificarRetoCompletado(String fcmToken, String tipoReto, int puntos) {
        enviarNotificacion(fcmToken,
            "🏆 ¡Reto completado!",
            "Completaste: " + tipoReto + " y ganaste " + puntos + " puntos eco 🌿");
    }

    public void notificarClimaExtremo(String fcmToken, String mensaje) {
        enviarNotificacion(fcmToken, "⚠ Alerta climática", mensaje);
    }

    public void notificarBienvenida(String fcmToken, String nombre) {
        enviarNotificacion(fcmToken,
            "¡Bienvenido a Senda Vida, " + nombre + "!",
            "Explora rutas, cuida el medio ambiente y gana puntos eco.");
    }

    public void notificarActividadFinalizada(String fcmToken, double distanciaKm, double calorias) {
        enviarNotificacion(fcmToken,
            " ¡Actividad completada!",
            String.format("Recorriste %.2f km y quemaste %.0f calorías ", distanciaKm, calorias));
    }
}