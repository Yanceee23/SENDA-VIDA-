package com.sendavida.controllers;

import com.google.firebase.FirebaseApp;
import com.sendavida.services.NotificacionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/notificaciones")
@RequiredArgsConstructor
public class NotificacionController {
    private final NotificacionService notificacionService;

    @PostMapping("/test")
    public ResponseEntity<?> testPush(@RequestBody Map<String, Object> body) {
        try {
            String token = body.get("token") != null ? String.valueOf(body.get("token")) : null;
            String title = body.get("title") != null ? String.valueOf(body.get("title")) : "SENDA VIDA";
            String message = body.get("message") != null ? String.valueOf(body.get("message")) : "Notificación de prueba";

            if (token == null || token.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "token requerido"));
            }
            if (FirebaseApp.getApps().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Firebase no inicializado. Agrega firebase-service-account.json y revisa firebase.config."
                ));
            }

            notificacionService.enviarNotificacion(token, title, message);
            return ResponseEntity.ok(Map.of("sent", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

