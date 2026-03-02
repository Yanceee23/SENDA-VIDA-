package com.sendavida.controllers;

import com.sendavida.services.HidratacionService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/hidratacion")
@RequiredArgsConstructor
public class HidratacionController {
    private final HidratacionService hidratacionService;

    @GetMapping("/{usuarioId}")
    public ResponseEntity<?> getRecordatorios(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(hidratacionService.getRecordatorios(usuarioId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{usuarioId}/pendientes")
    public ResponseEntity<?> getPendientes(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(hidratacionService.getPendientes(usuarioId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> crear(
            @RequestParam Long usuarioId,
            @RequestParam(required = false) String recordatorio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime tiempo
    ) {
        try {
            return ResponseEntity.ok(hidratacionService.crear(usuarioId, recordatorio, tiempo));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/completar")
    public ResponseEntity<?> completar(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(hidratacionService.completar(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(hidratacionService.eliminar(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

