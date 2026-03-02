package com.sendavida.controllers;

import com.sendavida.models.Reto;
import com.sendavida.models.Usuario;
import com.sendavida.services.NotificacionService;
import com.sendavida.services.RetoService;
import com.sendavida.services.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/retos")
@RequiredArgsConstructor
public class RetoController {
    private final RetoService retoService;
    private final UsuarioService usuarioService;
    private final NotificacionService notificacionService;

    private static String rootMessage(Throwable e) {
        Throwable cur = e;
        while (cur.getCause() != null && cur.getCause() != cur) cur = cur.getCause();
        return (cur.getMessage() != null && !cur.getMessage().isBlank())
                ? cur.getMessage()
                : (e.getMessage() != null ? e.getMessage() : e.toString());
    }

    private static Map<String, Object> retoDto(Reto r) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", r.getId());
        dto.put("tipoReto", r.getTipoReto());
        dto.put("puntos", r.getPuntos());
        dto.put("estado", r.getEstado());
        dto.put("rutaId", r.getRuta() != null ? r.getRuta().getId() : null);
        return dto;
    }

    @GetMapping("/{usuarioId}")
    public ResponseEntity<?> getRetos(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(
                    retoService.getRetos(usuarioId).stream().map(RetoController::retoDto).toList()
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }

    @GetMapping("/{usuarioId}/pendientes")
    public ResponseEntity<?> getPendientes(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(
                    retoService.getPendientes(usuarioId).stream().map(RetoController::retoDto).toList()
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }

    @GetMapping("/{usuarioId}/estadisticas")
    public ResponseEntity<?> getEstadisticas(@PathVariable Long usuarioId) {
        try {
            return ResponseEntity.ok(retoService.getEstadisticas(usuarioId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }

    @PostMapping
    public ResponseEntity<?> crear(
            @RequestParam Long usuarioId,
            @RequestParam(required = false) Long rutaId,
            @RequestParam String tipoReto,
            @RequestParam(defaultValue = "10") int puntos
    ) {
        try {
            Reto r = retoService.crear(usuarioId, rutaId, tipoReto, puntos);
            return ResponseEntity.ok(retoDto(r));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }

    @PutMapping("/{id}/completar")
    public ResponseEntity<?> completar(@PathVariable Long id) {
        try {
            Reto reto = retoService.completar(id);
            Usuario u = usuarioService.sumarPuntosEco(reto.getUsuario().getId(), reto.getPuntos());
            notificacionService.notificarRetoCompletado(u.getFcmToken(), reto.getTipoReto(), reto.getPuntos());
            return ResponseEntity.ok(retoDto(reto));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", rootMessage(e)));
        }
    }
}

