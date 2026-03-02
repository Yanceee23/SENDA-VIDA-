package com.sendavida.controllers;

import com.sendavida.services.ActividadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/actividades")
@RequiredArgsConstructor
public class ActividadController {
    private final ActividadService actividadService;

    @PostMapping("/iniciar")
    public ResponseEntity<?> iniciar(
            @RequestParam Long usuarioId,
            @RequestParam(required = false) Long rutaId,
            @RequestParam(required = false) String tipo
    ) {
        try {
            var a = actividadService.iniciar(usuarioId, rutaId, tipo);
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("id", a.getId());
            res.put("tipo", a.getTipo());
            res.put("estado", a.getEstado());
            res.put("rutaId", a.getRuta() != null ? a.getRuta().getId() : null);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/finalizar")
    public ResponseEntity<?> finalizar(@PathVariable Long id) {
        try {
            var a = actividadService.finalizar(id);
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("id", a.getId());
            res.put("tipo", a.getTipo());
            res.put("estado", a.getEstado());
            res.put("tiempoSegundos", a.getTiempoSegundos());
            res.put("distanciaKm", a.getDistanciaRecorrida());
            res.put("calorias", a.getCalorias());
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/activa/{usuarioId}")
    public ResponseEntity<?> getActiva(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(actividadService.getActiva(usuarioId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/historial/{usuarioId}")
    public ResponseEntity<?> getHistorial(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(actividadService.getHistorial(usuarioId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/resumen")
    public ResponseEntity<?> getResumen(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(actividadService.getResumen(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

