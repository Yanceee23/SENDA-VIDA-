package com.sendavida.services;

import com.sendavida.models.*;
import com.sendavida.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.*;

@Service @RequiredArgsConstructor @Slf4j
public class EmergenciaService {
    private final EmergenciaRepository emergenciaRepository;
    private final UsuarioRepository usuarioRepository;
    private final NotificacionService notificacionService;

    public Map<String, Object> crearEmergencia(Long usuarioId, double lat, double lng, String tipo) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        String gps = String.format("{\"lat\":%s,\"lng\":%s}", lat, lng);

        Emergencia e = new Emergencia();
        e.setUsuario(usuario);
        e.setUbicacion(gps);
        e.setTipo(tipo != null ? tipo : "general");
        e.setEstado("activa");
        emergenciaRepository.save(e);

        long contactosNotificados = 0;
        if (usuario.getContactosEmergencia() != null) {
            for (ContactoEmergencia c : usuario.getContactosEmergencia()) {
                if (c.isActivo()) {
                    notificacionService.notificarEmergencia(c.getTelefono(), usuario.getNombre(), gps);
                    log.warn("🚨 Emergencia → {} ({})", c.getNombre(), c.getTelefono());
                    contactosNotificados++;
                }
            }
        }
        return Map.of(
            "id", e.getId(), "estado", "activa",
            "tipo", e.getTipo(), "ubicacion", gps,
            "contactosNotificados", contactosNotificados
        );
    }

    public Map<String, Object> resolver(Long emergenciaId) {
        Emergencia e = emergenciaRepository.findById(emergenciaId)
            .orElseThrow(() -> new RuntimeException("Emergencia no encontrada"));
        e.setEstado("resuelta");
        emergenciaRepository.save(e);
        return Map.of("id", emergenciaId, "estado", "resuelta");
    }

    public List<Emergencia> getHistorial(Long usuarioId) {
        return emergenciaRepository.findByUsuarioIdOrderByFechaDesc(usuarioId);
    }
}
