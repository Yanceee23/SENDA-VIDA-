package com.sendavida.controllers;

import com.sendavida.services.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    private static String rootMessage(Throwable e) {
        Throwable cur = e;
        while (cur.getCause() != null && cur.getCause() != cur) cur = cur.getCause();
        return (cur.getMessage() != null && !cur.getMessage().isBlank())
                ? cur.getMessage()
                : (e.getMessage() != null ? e.getMessage() : e.toString());
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(authService.registrar(body));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
        try {
            Object rawCorreo = body != null ? body.get("correo") : null;
            Object rawPass = body != null ? body.get("password") : null;
            String correo = rawCorreo != null ? String.valueOf(rawCorreo).trim() : "";
            String password = rawPass instanceof String ? (String) rawPass : rawPass != null ? String.valueOf(rawPass) : "";
            if (correo.isEmpty() || password.isEmpty())
                return ResponseEntity.badRequest().body(Map.of("error", "Indica correo y contraseña."));
            return ResponseEntity.ok(authService.login(correo, password));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }

    @PutMapping("/fcm-token")
    public ResponseEntity<?> actualizarFcmToken(@RequestBody Map<String, Object> body) {
        try {
            Long userId = body.get("userId") != null ? ((Number) body.get("userId")).longValue() : null;
            String token = (String) body.get("token");
            return ResponseEntity.ok(authService.actualizarFcmToken(userId, token));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }
}

