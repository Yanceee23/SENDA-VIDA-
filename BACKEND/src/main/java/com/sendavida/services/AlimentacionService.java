package com.sendavida.services;

import com.sendavida.models.Alimentacion;
import com.sendavida.models.Usuario;
import com.sendavida.repository.AlimentacionRepository;
import com.sendavida.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service @RequiredArgsConstructor
public class AlimentacionService {
    private final AlimentacionRepository alimentacionRepository;
    private final UsuarioRepository usuarioRepository;

    public List<Alimentacion> getSugerencias(Long usuarioId) {
        return alimentacionRepository.findByUsuarioId(usuarioId);
    }

    public Alimentacion crear(Long usuarioId, String sugerencia, LocalDateTime tiempo) {
        Usuario u = usuarioRepository.findById(usuarioId)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Alimentacion a = new Alimentacion();
        a.setUsuario(u);
        a.setSugerencia(sugerencia != null ? sugerencia : "Comer algo nutritivo 🥗");
        a.setTiempo(tiempo != null ? tiempo : LocalDateTime.now().plusHours(2));
        a.setCompletado(false);
        return alimentacionRepository.save(a);
    }

    public Alimentacion completar(Long id) {
        Alimentacion a = alimentacionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Sugerencia no encontrada"));
        a.setCompletado(true);
        return alimentacionRepository.save(a);
    }

    public Map<String, Object> eliminar(Long id) {
        alimentacionRepository.deleteById(id);
        return Map.of("eliminado", true, "id", id);
    }
}
