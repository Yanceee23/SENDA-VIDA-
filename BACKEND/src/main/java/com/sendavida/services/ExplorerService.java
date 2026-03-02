package com.sendavida.services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import java.util.*;

@Service @RequiredArgsConstructor @Slf4j
public class ExplorerService {
    private final ClimaService climaService;
    private final RecomendacionService recomendacionService;
    private final RutaService rutaService;
    private final NotificacionService notificacionService;

    @SuppressWarnings("unchecked")
    public Map<String, Object> explorarLugar(double lat, double lng,
            String nombreLugar, String tipoLugar, String fcmToken) {
        // Llamadas paralelas a las 4 APIs externas
        Map<String, Object> resultado = Mono.zip(
            climaService.getClimaActualAsync(lat, lng),
            recomendacionService.getEspeciesGBIFAsync(lat, lng),
            rutaService.verificarZonaProtegidaAsync(lat, lng),
            rutaService.getDatosWikidataAsync(nombreLugar, tipoLugar)
        ).map(t -> {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("clima", t.getT1());
            res.put("especies", t.getT2());
            res.put("zona_protegida", t.getT3());
            res.put("wikidata", t.getT4());
            return res;
        }).block();

        if (resultado != null && fcmToken != null) {
            Map<String, Object> clima = (Map<String, Object>) resultado.get("clima");
            log.info(" Clima (Open-Meteo): {}°C — Condición: {}", clima.get("temperatura"), clima.get("condicion"));
            if (climaService.hayLluvia(clima))
                notificacionService.enviarNotificacion(fcmToken, "⚠ Alerta de lluvia", "Lluvia detectada en tu ruta. Precaución.");
            if (climaService.calorExtremo(clima))
                notificacionService.enviarNotificacion(fcmToken, "🌡 Calor extremo", "Temperatura alta. Hidrátate constantemente.");
            Map<String, Object> zona = (Map<String, Object>) resultado.get("zona_protegida");
            if (Boolean.TRUE.equals(zona.get("es_area_protegida")))
                notificacionService.enviarNotificacion(fcmToken, " Zona protegida",
                    "Estás en: " + zona.get("nombre_area") + ". Respeta la naturaleza.");
        }
        return resultado != null ? resultado : Collections.emptyMap();
    }
}