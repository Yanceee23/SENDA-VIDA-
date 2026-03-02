package com.sendavida.controllers;

import com.sendavida.services.ClimaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/clima")
@RequiredArgsConstructor
public class ClimaController {
    private final ClimaService climaService;

    @GetMapping("/actual")
    public ResponseEntity<?> actual(@RequestParam double lat, @RequestParam double lng) {
        try {
            return ResponseEntity.ok(climaService.getClimaActual(lat, lng));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/pronostico")
    public ResponseEntity<?> pronostico(@RequestParam double lat, @RequestParam double lng) {
        try {
            return ResponseEntity.ok(climaService.getPronostico7Dias(lat, lng));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

