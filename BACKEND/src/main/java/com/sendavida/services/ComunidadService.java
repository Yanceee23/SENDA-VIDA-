package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sendavida.models.Comunidad;
import com.sendavida.repository.ComunidadRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.*;

@Service @RequiredArgsConstructor @Slf4j
public class ComunidadService {
    private final ComunidadRepository comunidadRepository;
    private final ObjectMapper mapper;

    public List<Comunidad> getGrupos() { return comunidadRepository.findAll(); }

    public Comunidad crearGrupo(String nombre, String descripcion) {
        Comunidad c = new Comunidad();
        c.setNombreGrupo(nombre);
        c.setDescripcion(descripcion);
        c.setParticipantes(0);
        c.setCodigoInvitacion(generarCodigoInvitacion());
        c.setMensajes("[]");
        return comunidadRepository.save(c);
    }

    public Comunidad unirseGrupo(Long grupoId) {
        Comunidad c = comunidadRepository.findById(grupoId)
            .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));
        c.setParticipantes((c.getParticipantes() != null ? c.getParticipantes() : 0) + 1);
        return comunidadRepository.save(c);
    }

    public Comunidad actualizarCodigoInvitacion(Long grupoId, String codigo) {
        String normalizado = codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
        if (normalizado.length() != 6) {
            throw new RuntimeException("Código inválido");
        }
        Comunidad c = comunidadRepository.findById(grupoId)
            .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));
        c.setCodigoInvitacion(normalizado);
        return comunidadRepository.save(c);
    }

    public Comunidad buscarGrupoPorCodigo(String codigo) {
        String normalizado = codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
        if (normalizado.isBlank()) {
            throw new RuntimeException("Código inválido o expirado.");
        }
        return comunidadRepository.findByCodigoInvitacionIgnoreCase(normalizado)
            .orElseThrow(() -> new RuntimeException("Código inválido o expirado."));
    }

    @SuppressWarnings("unchecked")
    public Comunidad agregarMensaje(Long grupoId, String autorNombre, Long autorId, String texto) {
        Comunidad c = comunidadRepository.findById(grupoId)
            .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));
        try {
            List<Map<String, Object>> mensajes = mapper.readValue(
                c.getMensajes() != null ? c.getMensajes() : "[]", List.class);
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("id", System.currentTimeMillis());
            msg.put("autorId", autorId);
            msg.put("autor", autorNombre);
            msg.put("texto", texto);
            msg.put("hora", LocalDateTime.now().toString());
            mensajes.add(msg);
            c.setMensajes(mapper.writeValueAsString(mensajes));
            return comunidadRepository.save(c);
        } catch (Exception ex) {
            log.error("Error mensaje: {}", ex.getMessage());
            return c;
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getMensajes(Long grupoId) {
        Comunidad c = comunidadRepository.findById(grupoId)
            .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));
        try {
            return mapper.readValue(c.getMensajes() != null ? c.getMensajes() : "[]", List.class);
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String generarCodigoInvitacion() {
        String codigo = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
        if (comunidadRepository.findByCodigoInvitacionIgnoreCase(codigo).isPresent()) {
            return generarCodigoInvitacion();
        }
        return codigo;
    }
}