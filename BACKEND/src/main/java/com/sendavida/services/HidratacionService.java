package com.sendavida.services;

import com.sendavida.models.Hidratacion;
import com.sendavida.models.Usuario;
import com.sendavida.repository.HidratacionRepository;
import com.sendavida.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service @RequiredArgsConstructor
public class HidratacionService {
    private final HidratacionRepository hidratacionRepository;
    private final UsuarioRepository usuarioRepository;

    public List<Hidratacion> getRecordatorios(Long usuarioId) {
        return hidratacionRepository.findByUsuarioId(usuarioId);
    }

    public List<Hidratacion> getPendientes(Long usuarioId) {
        return hidratacionRepository.findByUsuarioIdAndCompletadoFalse(usuarioId);
    }

    public Hidratacion crear(Long usuarioId, String recordatorio, LocalDateTime tiempo) {
        Usuario u = usuarioRepository.findById(usuarioId)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Hidratacion h = new Hidratacion();
        h.setUsuario(u);
        h.setRecordatorio(recordatorio != null ? recordatorio : "Beber agua 💧");
        h.setTiempo(tiempo != null ? tiempo : LocalDateTime.now().plusHours(1));
        h.setCompletado(false);
        return hidratacionRepository.save(h);
    }

    public Hidratacion completar(Long id) {
        Hidratacion h = hidratacionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Recordatorio no encontrado"));
        h.setCompletado(true);
        return hidratacionRepository.save(h);
    }

    public Map<String, Object> eliminar(Long id) {
        hidratacionRepository.deleteById(id);
        return Map.of("eliminado", true, "id", id);
    }
}

