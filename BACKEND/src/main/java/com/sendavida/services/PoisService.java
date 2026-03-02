package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sendavida.utils.GpsCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PoisService {
    @Value("${overpass.url}")
    private String overpassUrl;

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper mapper;
    private final GpsCalculator gps;

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> nearby(double lat, double lng, int radiusM, int limit) {
        int r = Math.max(100, Math.min(radiusM, 50000));
        int lim = Math.max(1, Math.min(limit, 50));

        try {
            String query = String.format(
                    "[out:json][timeout:25];("
                            + "node[\"tourism\"~\"^(attraction|museum|information|viewpoint)$\"](around:%d,%s,%s);"
                            + "way[\"tourism\"~\"^(attraction|museum|information|viewpoint)$\"](around:%d,%s,%s);"
                            + "node[\"historic\"~\"^(archaeological_site|ruins|monument|memorial|castle|fort|temple)$\"](around:%d,%s,%s);"
                            + "way[\"historic\"~\"^(archaeological_site|ruins|monument|memorial|castle|fort|temple)$\"](around:%d,%s,%s);"
                            + "node[\"ruins\"=\"yes\"](around:%d,%s,%s);"
                            + "way[\"ruins\"=\"yes\"](around:%d,%s,%s);"
                            + "node[\"natural\"~\"^(peak|volcano|beach|cave_entrance|spring)$\"](around:%d,%s,%s);"
                            + "way[\"natural\"~\"^(peak|volcano|beach|cave_entrance|spring)$\"](around:%d,%s,%s);"
                            + "node[\"amenity\"~\"^(parking|restaurant|cafe|hospital|pharmacy|place_of_worship)$\"](around:%d,%s,%s);"
                            + "way[\"amenity\"~\"^(parking|restaurant|cafe|hospital|pharmacy|place_of_worship)$\"](around:%d,%s,%s);"
                            + "node[\"leisure\"~\"^(park|nature_reserve|garden)$\"](around:%d,%s,%s);"
                            + "way[\"leisure\"~\"^(park|nature_reserve|garden)$\"](around:%d,%s,%s);"
                            + ");out center;",
                    r, lat, lng, r, lat, lng, r, lat, lng, r, lat, lng, r, lat, lng, r, lat, lng,
                    r, lat, lng, r, lat, lng, r, lat, lng, r, lat, lng, r, lat, lng, r, lat, lng
            );

            String body = "data=" + java.net.URLEncoder.encode(query, StandardCharsets.UTF_8);
            String raw = webClientBuilder.build()
                    .post()
                    .uri(overpassUrl)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            Map<String, Object> json = mapper.readValue(raw, Map.class);
            List<Map<String, Object>> elements =
                    (List<Map<String, Object>>) json.getOrDefault("elements", Collections.emptyList());

            Map<String, Map<String, Object>> unique = new LinkedHashMap<>();
            for (Map<String, Object> el : elements) {
                String type = String.valueOf(el.get("type"));
                Object idObj = el.get("id");
                if (idObj == null) continue;

                Map<String, Object> tags = (Map<String, Object>) el.get("tags");
                if (tags == null || tags.isEmpty()) continue;
                if (tags.containsKey("barrier")) continue;

                Double pLat = null;
                Double pLng = null;
                if ("node".equals(type)) {
                    Object la = el.get("lat");
                    Object lo = el.get("lon");
                    if (la instanceof Number n1 && lo instanceof Number n2) {
                        pLat = n1.doubleValue();
                        pLng = n2.doubleValue();
                    }
                } else {
                    Map<String, Object> center = (Map<String, Object>) el.get("center");
                    if (center != null) {
                        Object la = center.get("lat");
                        Object lo = center.get("lon");
                        if (la instanceof Number n1 && lo instanceof Number n2) {
                            pLat = n1.doubleValue();
                            pLng = n2.doubleValue();
                        }
                    }
                }
                if (pLat == null || pLng == null) continue;

                String key = type + ":" + idObj;
                if (unique.containsKey(key)) continue;

                String name = firstString(tags, "name:es", "name");
                if (name == null || name.isBlank()) {
                    name = buildFallbackName(tags);
                }

                String kind = firstString(tags, "tourism", "historic", "natural", "amenity", "leisure", "ruins");
                double distKm = gps.distanciaKm(lat, lng, pLat, pLng);

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("osm_type", type);
                row.put("osm_id", idObj);
                row.put("nombre", name);
                row.put("tipo", kind);
                row.put("lat", pLat);
                row.put("lng", pLng);
                row.put("distancia_km", Math.round(distKm * 100.0) / 100.0);
                row.put("tags", tags);
                unique.put(key, row);
            }

            List<Map<String, Object>> out = new ArrayList<>(unique.values());
            out.sort(Comparator.comparingDouble(o -> ((Number) o.getOrDefault("distancia_km", 999999)).doubleValue()));
            if (out.size() > lim) return out.subList(0, lim);
            return out;
        } catch (Exception e) {
            log.error("Pois Overpass error para lat={}, lng={}: {}", lat, lng, e.getMessage(), e);
            return List.of();
        }
    }

    private static String buildFallbackName(Map<String, Object> tags) {
        String kind = firstString(tags, "tourism", "historic", "natural", "amenity", "leisure");
        if (kind != null && !kind.isBlank()) {
            return "Punto de interés (" + kind + ")";
        }
        return "Punto de interés";
    }

    private static String firstString(Map<String, Object> m, String... keys) {
        for (String k : keys) {
            Object v = m.get(k);
            if (v != null) {
                String s = String.valueOf(v);
                if (!s.isBlank()) return s;
            }
        }
        return null;
    }
}

