package com.sendavida.controllers;

import com.sendavida.services.UbicacionCompartidaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/ubicacion")
@RequiredArgsConstructor
public class UbicacionController {
    private final UbicacionCompartidaService ubicacionCompartidaService;

    @PostMapping("/compartir")
    public ResponseEntity<?> compartir(@RequestParam Long usuarioId, @RequestParam double lat, @RequestParam double lng) {
        try {
            return ResponseEntity.ok(ubicacionCompartidaService.compartir(usuarioId, lat, lng));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/actualizar")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestParam double lat, @RequestParam double lng) {
        try {
            return ResponseEntity.ok(ubicacionCompartidaService.actualizar(id, lat, lng));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/detener")
    public ResponseEntity<?> detener(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(ubicacionCompartidaService.detener(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/activa/{actividadId}")
    public ResponseEntity<?> getActiva(@PathVariable Long actividadId) {
        try {
            return ResponseEntity.ok(ubicacionCompartidaService.getActiva(actividadId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

