package com.sendavida.controllers;

import com.sendavida.services.ComunidadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/comunidad")
@RequiredArgsConstructor
public class ComunidadController {
    private final ComunidadService comunidadService;

    @GetMapping("/grupos")
    public ResponseEntity<?> getGrupos() {
        try {
            return ResponseEntity.ok(comunidadService.getGrupos());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/grupos")
    public ResponseEntity<?> crearGrupo(@RequestBody Map<String, Object> body) {
        try {
            String nombre = body.get("nombre") != null ? String.valueOf(body.get("nombre")).trim() : "";
            String descripcion = body.get("descripcion") != null ? String.valueOf(body.get("descripcion")).trim() : "";
            if (nombre.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "El nombre del grupo es requerido."));
            }
            return ResponseEntity.ok(comunidadService.crearGrupo(nombre, descripcion));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/grupos/{id}/unirse")
    public ResponseEntity<?> unirse(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(comunidadService.unirseGrupo(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/grupos/{id}/codigo")
    public ResponseEntity<?> actualizarCodigo(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            String codigo = body.get("codigo") != null ? String.valueOf(body.get("codigo")) : "";
            return ResponseEntity.ok(comunidadService.actualizarCodigoInvitacion(id, codigo));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/grupos/{id}/mensajes")
    public ResponseEntity<?> mensajes(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(comunidadService.getMensajes(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/grupos/{id}/mensajes")
    public ResponseEntity<?> agregarMensaje(
            @PathVariable Long id,
            @RequestParam String autorNombre,
            @RequestParam Long autorId,
            @RequestParam String texto
    ) {
        try {
            return ResponseEntity.ok(comunidadService.agregarMensaje(id, autorNombre, autorId, texto));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

