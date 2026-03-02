package com.sendavida.controllers;

import com.sendavida.services.EmergenciaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/emergencias")
@RequiredArgsConstructor
public class EmergenciaController {
    private final EmergenciaService emergenciaService;

    @PostMapping
    public ResponseEntity<?> crear(
            @RequestParam Long usuarioId,
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) String tipo
    ) {
        try {
            return ResponseEntity.ok(emergenciaService.crearEmergencia(usuarioId, lat, lng, tipo));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/resolver")
    public ResponseEntity<?> resolver(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(emergenciaService.resolver(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{usuarioId}")
    public ResponseEntity<?> historial(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(emergenciaService.getHistorial(usuarioId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

