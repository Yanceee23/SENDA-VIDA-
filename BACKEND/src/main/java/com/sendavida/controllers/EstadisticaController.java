package com.sendavida.controllers;

import com.sendavida.services.EstadisticaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/estadisticas")
@RequiredArgsConstructor
public class EstadisticaController {
    private final EstadisticaService estadisticaService;

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(estadisticaService.registrar(body));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
