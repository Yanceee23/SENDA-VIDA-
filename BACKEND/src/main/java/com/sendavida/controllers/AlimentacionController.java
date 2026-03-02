package com.sendavida.controllers;

import com.sendavida.services.AlimentacionService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/alimentacion")
@RequiredArgsConstructor
public class AlimentacionController {
    private final AlimentacionService alimentacionService;

    @GetMapping("/{usuarioId}")
    public ResponseEntity<?> getSugerencias(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(alimentacionService.getSugerencias(usuarioId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> crear(
            @RequestParam Long usuarioId,
            @RequestParam(required = false) String sugerencia,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime tiempo
    ) {
        try {
            return ResponseEntity.ok(alimentacionService.crear(usuarioId, sugerencia, tiempo));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/completar")
    public ResponseEntity<?> completar(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(alimentacionService.completar(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(alimentacionService.eliminar(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

