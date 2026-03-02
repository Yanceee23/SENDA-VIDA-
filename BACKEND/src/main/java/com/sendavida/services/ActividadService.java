package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sendavida.models.*;
import com.sendavida.repository.*;
import com.sendavida.utils.GpsCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @RequiredArgsConstructor
public class ActividadService {
    private final ActividadRepository actividadRepository;
    private final UsuarioRepository usuarioRepository;
    private final RutaRepository rutaRepository;
    private final GpsCalculator gpsCalculator;
    private final ObjectMapper mapper;

    public Actividad iniciar(Long usuarioId, Long rutaId, String tipo) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        // Si ya tiene una activa, la cerramos
        actividadRepository.findByUsuarioIdAndEstado(usuarioId, "activa")
            .ifPresent(a -> { a.setEstado("cancelada"); actividadRepository.save(a); });

        Actividad actividad = new Actividad();
        actividad.setUsuario(usuario);
        actividad.setTipo(tipo != null ? tipo : "senderismo");
        actividad.setEstado("activa");
        actividad.setIniciadaEn(LocalDateTime.now());
        actividad.setDistanciaRecorrida(BigDecimal.ZERO);
        actividad.setCalorias(BigDecimal.ZERO);
        actividad.setTiempoSegundos(0);
        actividad.setGpsRecorrido("[]");
        if (rutaId != null)
            rutaRepository.findById(rutaId).ifPresent(actividad::setRuta);
        return actividadRepository.save(actividad);
    }

    public Actividad finalizar(Long actividadId) {
        Actividad a = actividadRepository.findById(actividadId)
            .orElseThrow(() -> new RuntimeException("Actividad no encontrada"));
        a.setEstado("finalizada");
        a.setFinalizadaEn(LocalDateTime.now());
        if (a.getIniciadaEn() != null) {
            long seg = ChronoUnit.SECONDS.between(a.getIniciadaEn(), a.getFinalizadaEn());
            a.setTiempoSegundos((int) seg);
        }
        return actividadRepository.save(a);
    }

    public Optional<Actividad> getActiva(Long usuarioId) {
        return actividadRepository.findByUsuarioIdAndEstado(usuarioId, "activa");
    }

    public List<Actividad> getHistorial(Long usuarioId) {
        return actividadRepository.findByUsuarioIdOrderByIniciadaEnDesc(usuarioId);
    }

    public Map<String, Object> getResumen(Long actividadId) {
        Actividad a = actividadRepository.findById(actividadId)
            .orElseThrow(() -> new RuntimeException("Actividad no encontrada"));
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", a.getId());
        res.put("tipo", a.getTipo());
        res.put("estado", a.getEstado());
        res.put("distanciaKm", a.getDistanciaRecorrida());
        res.put("calorias", a.getCalorias());
        res.put("tiempoSegundos", a.getTiempoSegundos());
        res.put("iniciadaEn", a.getIniciadaEn());
        res.put("finalizadaEn", a.getFinalizadaEn());
        if (a.getRuta() != null) {
            res.put("rutaId", a.getRuta().getId());
            res.put("rutaNombre", a.getRuta().getNombre());
        }
        return res;
    }

    public Actividad actualizarGps(Long actividadId, double lat, double lng) throws Exception {
        Actividad a = actividadRepository.findById(actividadId)
            .orElseThrow(() -> new RuntimeException("Actividad no encontrada"));
        List<Map<String, Object>> gpsRecorrido = new ArrayList<>();
        if (a.getGpsRecorrido() != null && !a.getGpsRecorrido().equals("[]"))
            gpsRecorrido = mapper.readValue(a.getGpsRecorrido(), List.class);

        double distIncremental = 0.0;
        if (!gpsRecorrido.isEmpty()) {
            Map<?, ?> ultimo = gpsRecorrido.get(gpsRecorrido.size() - 1);
            double dLat = ((Number) ultimo.get("lat")).doubleValue();
            double dLng = ((Number) ultimo.get("lng")).doubleValue();
            double d = gpsCalculator.distanciaKm(dLat, dLng, lat, lng);
            if (d >= 0.005) distIncremental = d;
        }

        Map<String, Object> punto = new LinkedHashMap<>();
        punto.put("lat", lat); punto.put("lng", lng); punto.put("ts", System.currentTimeMillis());
        gpsRecorrido.add(punto);

        double nuevaDist = (a.getDistanciaRecorrida() != null ? a.getDistanciaRecorrida().doubleValue() : 0.0) + distIncremental;
        double pesoKg = (a.getUsuario() != null && a.getUsuario().getPeso() != null) ? a.getUsuario().getPeso().doubleValue() : 70.0;
        double calorias = gpsCalculator.calcularCalorias(nuevaDist, pesoKg, a.getTipo());

        a.setDistanciaRecorrida(BigDecimal.valueOf(nuevaDist));
        a.setCalorias(BigDecimal.valueOf(calorias));
        a.setGpsRecorrido(mapper.writeValueAsString(gpsRecorrido));
        return actividadRepository.save(a);
    }
}
