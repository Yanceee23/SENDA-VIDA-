package com.sendavida.controllers;

import com.sendavida.services.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/usuarios")
@RequiredArgsConstructor
public class UsuarioController {
    private final UsuarioService usuarioService;

    private static String rootMessage(Throwable e) {
        Throwable cur = e;
        while (cur.getCause() != null && cur.getCause() != cur) cur = cur.getCause();
        return (cur.getMessage() != null && !cur.getMessage().isBlank())
                ? cur.getMessage()
                : (e.getMessage() != null ? e.getMessage() : e.toString());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPerfil(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(usuarioService.getPerfil(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(usuarioService.actualizar(id, body));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> cambiarPassword(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        try {
            String actual = (String) body.get("actual");
            String nueva = (String) body.get("nueva");
            return ResponseEntity.ok(usuarioService.cambiarPassword(id, actual, nueva));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }
}

