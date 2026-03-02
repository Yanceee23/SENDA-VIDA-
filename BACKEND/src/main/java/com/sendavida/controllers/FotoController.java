package com.sendavida.controllers;

import com.sendavida.services.FotoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/fotos")
@RequiredArgsConstructor
public class FotoController {
    private final FotoService fotoService;

    @GetMapping("/{usuarioId}")
    public ResponseEntity<?> getFotos(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(fotoService.getFotosDto(usuarioId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/actividad/{actividadId}")
    public ResponseEntity<?> getFotosPorActividad(@PathVariable Long actividadId) {
        try {
            return ResponseEntity.ok(fotoService.getFotosPorActividad(actividadId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> guardar(
            @RequestParam Long usuarioId,
            @RequestParam String urlFoto,
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Long actividadId,
            @RequestParam(required = false) Long rutaId,
            @RequestParam(required = false) String nombreLugar
    ) {
        try {
            return ResponseEntity.ok(fotoService.guardar(usuarioId, urlFoto, lat, lng, actividadId, rutaId, nombreLugar));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> subirYGuardar(
            @RequestParam Long usuarioId,
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Long actividadId,
            @RequestParam(required = false) Long rutaId,
            @RequestParam(required = false) String nombreLugar,
            @RequestParam("file") MultipartFile file
    ) {
        try {
            return ResponseEntity.ok(fotoService.guardarConArchivo(usuarioId, file, lat, lng, actividadId, rutaId, nombreLugar));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(fotoService.eliminar(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

