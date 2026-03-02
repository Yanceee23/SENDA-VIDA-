package com.sendavida.controllers;

import com.sendavida.repository.RutaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.text.Normalizer;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/rutas")
@RequiredArgsConstructor
public class RutaController {
    private final RutaRepository rutaRepository;

    @GetMapping
    public ResponseEntity<?> getAll() {
        try {
            return ResponseEntity.ok(rutaRepository.findAll());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(rutaRepository.findById(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/tipo/{tipo}")
    public ResponseEntity<?> getByTipo(@PathVariable String tipo) {
        try {
            List<String> candidates = normalizeTipoCandidates(tipo);
            if (candidates.isEmpty()) {
                return ResponseEntity.ok(List.of());
            }
            if (candidates.contains("todas")) {
                return ResponseEntity.ok(rutaRepository.findAll());
            }

            // Buscar por candidatos (lower) para tolerar plural/singular, acentos y mayúsculas.
            List<String> lower = candidates.stream().map(s -> s.toLowerCase().trim()).distinct().toList();
            return ResponseEntity.ok(rutaRepository.findByTipoInLower(lower));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private static List<String> normalizeTipoCandidates(String raw) {
        if (raw == null) return List.of();
        String t = raw.trim().toLowerCase();
        if (t.isBlank()) return List.of();

        // quitar acentos: "río" -> "rio", "montaña" -> "montana"
        t = Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");

        if (t.equals("todas") || t.equals("todo") || t.equals("all")) return List.of("todas");

        // Formas conocidas (app + usuario)
        return switch (t) {
            case "volcanes", "volcan" -> List.of("volcanes", "volcan");
            case "montanas", "montana" -> List.of("montanas", "montana");
            case "parques", "parque" -> List.of("parques", "parque");
            case "rios", "rio" -> List.of("rios", "rio");
            case "lagos", "lago" -> List.of("lagos", "lago");
            case "playas", "playa" -> List.of("playas", "playa");
            default -> {
                // fallback: intentar singular/plural simple
                if (t.endsWith("s") && t.length() > 3) yield List.of(t, t.substring(0, t.length() - 1));
                yield List.of(t, t + "s");
            }
        };
    }
}

