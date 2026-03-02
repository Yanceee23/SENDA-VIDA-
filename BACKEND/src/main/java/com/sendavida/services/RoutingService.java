package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoutingService {
    @Value("${osrm.url:https://router.project-osrm.org}")
    private String osrmUrl;

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper mapper;

    @SuppressWarnings("unchecked")
    public Map<String, Object> route(String profile, double startLat, double startLng, double endLat, double endLng) {
        String p = (profile == null ? "walking" : profile.trim().toLowerCase());
        if (!p.equals("walking") && !p.equals("cycling")) p = "walking";

        // OSRM usa (lon,lat)
        String url = osrmUrl
                + "/route/v1/"
                + p
                + "/"
                + startLng + "," + startLat
                + ";"
                + endLng + "," + endLat
                + "?overview=full&geometries=geojson";

        try {
            String raw = webClientBuilder.build()
                    .get()
                    .uri(url)
                    .header("User-Agent", "SendaVidaApp/1.0")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            Map<String, Object> json = mapper.readValue(raw, Map.class);
            List<Map<String, Object>> routes = (List<Map<String, Object>>) json.get("routes");
            if (routes == null || routes.isEmpty()) return Map.of("error", "No se encontró ruta");

            Map<String, Object> r0 = routes.get(0);
            Object dist = r0.get("distance");
            Object dur = r0.get("duration");

            Map<String, Object> geom = (Map<String, Object>) r0.get("geometry");
            List<List<Number>> coords = geom != null ? (List<List<Number>>) geom.get("coordinates") : null;

            List<Map<String, Object>> geometry = new ArrayList<>();
            if (coords != null) {
                for (List<Number> c : coords) {
                    if (c == null || c.size() < 2) continue;
                    double lon = c.get(0).doubleValue();
                    double lat = c.get(1).doubleValue();
                    geometry.add(Map.of("lat", lat, "lng", lon));
                }
            }

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("distance_m", dist);
            out.put("duration_s", dur);
            out.put("geometry", geometry);
            return out;
        } catch (Exception e) {
            log.error("Routing OSRM error: {}", e.getMessage());
            return Map.of("error", "Servicio de ruteo no disponible");
        }
    }
}

