package com.sendavida.services;

import com.sendavida.models.UbicacionCompartida;
import com.sendavida.models.Usuario;
import com.sendavida.repository.UbicacionCompartidaRepository;
import com.sendavida.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.Optional;

@Service @RequiredArgsConstructor
public class UbicacionCompartidaService {
    private final UbicacionCompartidaRepository repo;
    private final UsuarioRepository usuarioRepository;

    public UbicacionCompartida compartir(Long usuarioId, double lat, double lng) {
        Usuario u = usuarioRepository.findById(usuarioId)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        // Desactivar la anterior si existe
        repo.findByUsuarioIdAndActivaTrue(usuarioId)
            .ifPresent(uc -> { uc.setActiva(false); repo.save(uc); });

        UbicacionCompartida uc = new UbicacionCompartida();
        uc.setUsuario(u);
        uc.setGps(String.format("{\"lat\":%s,\"lng\":%s}", lat, lng));
        uc.setActiva(true);
        uc.setCompartidoCon("[]");
        return repo.save(uc);
    }

    public UbicacionCompartida actualizar(Long id, double lat, double lng) {
        UbicacionCompartida uc = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Ubicación no encontrada"));
        uc.setGps(String.format("{\"lat\":%s,\"lng\":%s}", lat, lng));
        return repo.save(uc);
    }

    public Map<String, Object> detener(Long id) {
        UbicacionCompartida uc = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Ubicación no encontrada"));
        uc.setActiva(false);
        repo.save(uc);
        return Map.of("detenida", true, "id", id);
    }

    public Optional<UbicacionCompartida> getActiva(Long actividadId) {
        return repo.findByActividadIdAndActivaTrue(actividadId);
    }

    public Optional<UbicacionCompartida> getActivaPorUsuario(Long usuarioId) {
        return repo.findByUsuarioIdAndActivaTrue(usuarioId);
    }
}