package com.sendavida.services;

import com.sendavida.models.Estadistica;
import com.sendavida.models.Usuario;
import com.sendavida.repository.EstadisticaRepository;
import com.sendavida.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EstadisticaService {
    private final EstadisticaRepository estadisticaRepository;
    private final UsuarioRepository usuarioRepository;

    public Map<String, Object> registrar(Map<String, Object> body) {
        Long userId = toLong(body.get("userId"));
        if (userId == null) {
            throw new RuntimeException("userId es requerido");
        }
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        String fechaRaw = body.get("fecha") != null ? String.valueOf(body.get("fecha")).trim() : "";
        LocalDate fecha = fechaRaw.isBlank() ? LocalDate.now() : LocalDate.parse(fechaRaw);

        BigDecimal distanciaKm = toBigDecimal(body.get("distanciaKm"));
        BigDecimal calorias = toBigDecimal(body.get("calorias"));
        String tipo = body.get("tipo") != null ? String.valueOf(body.get("tipo")) : "senderismo";

        Estadistica e = new Estadistica();
        e.setUsuario(usuario);
        e.setFecha(fecha);
        e.setDistanciaKm(distanciaKm);
        e.setCalorias(calorias);
        e.setTipo(tipo);
        Estadistica saved = estadisticaRepository.save(e);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", saved.getId());
        out.put("userId", userId);
        out.put("fecha", saved.getFecha());
        out.put("distanciaKm", saved.getDistanciaKm());
        out.put("calorias", saved.getCalorias());
        out.put("tipo", saved.getTipo());
        return out;
    }

    private static Long toLong(Object v) {
        if (v == null) return null;
        try {
            return Long.valueOf(String.valueOf(v));
        } catch (Exception e) {
            return null;
        }
    }

    private static BigDecimal toBigDecimal(Object v) {
        if (v == null) return BigDecimal.ZERO;
        try {
            return BigDecimal.valueOf(Double.parseDouble(String.valueOf(v)));
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }
}
