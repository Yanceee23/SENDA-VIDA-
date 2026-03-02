package com.sendavida.controllers;

import com.sendavida.services.RecomendacionService;
import com.sendavida.services.RutaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/recomendacion")
@RequiredArgsConstructor
public class RecomendacionController {
    private final RecomendacionService recomendacionService;
    private final RutaService rutaService;

    @GetMapping("/ambiental")
    public ResponseEntity<?> ambiental(@RequestParam double lat, @RequestParam double lng) {
        try {
            return ResponseEntity.ok(recomendacionService.getDatosAmbientalesCompletos(lat, lng));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/zona")
    public ResponseEntity<?> zona(@RequestParam double lat, @RequestParam double lng) {
        try {
            return ResponseEntity.ok(rutaService.verificarZonaProtegida(lat, lng, 1000));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/wikidata")
    public ResponseEntity<?> wikidata(@RequestParam String nombre, @RequestParam String tipo) {
        try {
            return ResponseEntity.ok(rutaService.getDatosWikidata(nombre, tipo));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

