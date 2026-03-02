package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeoService {
    @Value("${nominatim.url:https://nominatim.openstreetmap.org}")
    private String nominatimUrl;

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper mapper;

    @SuppressWarnings("unchecked")
    public Map<String, Object> reverse(double lat, double lng) {
        try {
            String url = nominatimUrl
                    + "/reverse?format=jsonv2"
                    + "&lat=" + lat
                    + "&lon=" + lng
                    + "&addressdetails=1"
                    + "&accept-language=es";

            String raw = webClientBuilder.build()
                    .get()
                    .uri(url)
                    .header("User-Agent", "SendaVidaApp/1.0")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            Map<String, Object> json = mapper.readValue(raw, Map.class);
            Map<String, Object> addr = (Map<String, Object>) json.get("address");

            Map<String, Object> res = new LinkedHashMap<>();
            res.put("lat", lat);
            res.put("lng", lng);
            res.put("display_name", json.get("display_name"));
            if (addr != null) {
                res.put("pais", addr.get("country"));
                res.put("pais_codigo", addr.get("country_code"));
                res.put("region", firstNonNull(addr, "state", "region", "state_district"));
                res.put("ciudad", firstNonNull(addr, "city", "town", "village", "municipality", "county"));
                res.put("barrio", firstNonNull(addr, "suburb", "neighbourhood"));
            }
            return res;
        } catch (Exception e) {
            log.error("Geo reverse error: {}", e.getMessage());
            return Map.of("lat", lat, "lng", lng, "error", "Geo no disponible");
        }
    }

    public Mono<Map<String, Object>> reverseAsync(double lat, double lng) {
        return Mono.fromCallable(() -> reverse(lat, lng)).subscribeOn(Schedulers.boundedElastic());
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> search(String query, int limit) {
        int lim = Math.max(1, Math.min(limit, 10));
        String q = query == null ? "" : query.trim();
        if (q.isBlank()) return List.of();

        try {
            String url = nominatimUrl
                    + "/search?format=jsonv2"
                    + "&q=" + java.net.URLEncoder.encode(q, java.nio.charset.StandardCharsets.UTF_8)
                    + "&addressdetails=1"
                    + "&accept-language=es"
                    + "&limit=" + lim;

            String raw = webClientBuilder.build()
                    .get()
                    .uri(url)
                    .header("User-Agent", "SendaVidaApp/1.0")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            List<Map<String, Object>> list = mapper.readValue(raw, List.class);
            if (list == null) return List.of();

            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> row : list) {
                Map<String, Object> res = new LinkedHashMap<>();
                res.put("display_name", row.get("display_name"));
                res.put("lat", row.get("lat"));
                res.put("lng", row.get("lon"));
                res.put("type", row.get("type"));
                res.put("class", row.get("class"));
                res.put("importance", row.get("importance"));
                out.add(res);
            }
            return out;
        } catch (Exception e) {
            log.error("Geo search error: {}", e.getMessage());
            return List.of();
        }
    }

    private static Object firstNonNull(Map<String, Object> m, String... keys) {
        for (String k : keys) {
            Object v = m.get(k);
            if (v != null) return v;
        }
        return null;
    }
}

