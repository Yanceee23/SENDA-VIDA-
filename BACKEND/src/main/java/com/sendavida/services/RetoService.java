package com.sendavida.services;

import com.sendavida.models.Reto;
import com.sendavida.models.Ruta;
import com.sendavida.models.Usuario;
import com.sendavida.repository.RetoRepository;
import com.sendavida.repository.RutaRepository;
import com.sendavida.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;

@Service @RequiredArgsConstructor
public class RetoService {
    private final RetoRepository retoRepository;
    private final UsuarioRepository usuarioRepository;
    private final RutaRepository rutaRepository;

    public List<Reto> getRetos(Long usuarioId) {
        return retoRepository.findByUsuarioId(usuarioId);
    }

    public List<Reto> getPendientes(Long usuarioId) {
        return retoRepository.findByUsuarioIdAndEstado(usuarioId, "pendiente");
    }

    public List<Reto> getCompletados(Long usuarioId) {
        return retoRepository.findByUsuarioIdAndEstado(usuarioId, "completado");
    }

    public Reto crear(Long usuarioId, Long rutaId, String tipoReto, int puntos) {
        Usuario u = usuarioRepository.findById(usuarioId)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Reto r = new Reto();
        r.setUsuario(u);
        r.setTipoReto(tipoReto);
        r.setPuntos(puntos > 0 ? puntos : 10);
        r.setEstado("pendiente");
        if (rutaId != null)
            rutaRepository.findById(rutaId).ifPresent(r::setRuta);
        return retoRepository.save(r);
    }

    public Reto completar(Long id) {
        Reto r = retoRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Reto no encontrado"));
        r.setEstado("completado");
        return retoRepository.save(r);
    }

    public Map<String, Object> getEstadisticas(Long usuarioId) {
        List<Reto> todos = getRetos(usuarioId);
        long completados = todos.stream().filter(r -> "completado".equals(r.getEstado())).count();
        int puntosTotal = todos.stream()
            .filter(r -> "completado".equals(r.getEstado()))
            .mapToInt(r -> r.getPuntos() != null ? r.getPuntos() : 0).sum();
        return Map.of(
            "total", todos.size(),
            "completados", completados,
            "pendientes", todos.size() - completados,
            "puntosGanados", puntosTotal
        );
    }
}
