package com.sendavida.controllers;

import com.sendavida.services.ExplorerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/explorer")
@RequiredArgsConstructor
public class ExplorerController {
    private final ExplorerService explorerService;

    @PostMapping("/explorar")
    public ResponseEntity<?> explorar(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam String nombre,
            @RequestParam String tipo,
            @RequestParam(required = false) String fcmToken
    ) {
        try {
            return ResponseEntity.ok(explorerService.explorarLugar(lat, lng, nombre, tipo, fcmToken));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

