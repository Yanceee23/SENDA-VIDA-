package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class EcoPlacesService {
    @Value("${overpass.url}")
    private String overpassUrl;

    private static final long TTL_MS = 6L * 60L * 60L * 1000L; // 6h

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper mapper;

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(long storedAtMs, List<Map<String, Object>> items) {}

    private static final List<Map<String, Object>> RIOS_FALLBACK = List.of(
            fallbackRiver("fallback-river:lempa", "Río Lempa", 13.705, -88.860, "Río principal de El Salvador"),
            fallbackRiver("fallback-river:paz", "Río Paz", 13.812, -90.095, "Río fronterizo entre El Salvador y Guatemala"),
            fallbackRiver("fallback-river:goascoran", "Río Goascorán", 13.470, -87.830, "Río fronterizo entre El Salvador y Honduras"),
            fallbackRiver("fallback-river:torola", "Río Torola", 13.872, -88.158, "Río del oriente de El Salvador"),
            fallbackRiver("fallback-river:sumpul", "Río Sumpul", 14.105, -89.090, "Río del norte de El Salvador"),
            fallbackRiver("fallback-river:acelhuate", "Río Acelhuate", 13.738, -89.160, "Río de la zona central de El Salvador"),
            fallbackRiver("fallback-river:sucio", "Río Sucio", 13.775, -89.440, "Río de la zona occidental-central de El Salvador"),
            fallbackRiver("fallback-river:jiboa", "Río Jiboa", 13.547, -88.980, "Río de la zona paracentral de El Salvador"),
            fallbackRiver("fallback-river:grande-san-miguel", "Río Grande de San Miguel", 13.452, -88.165, "Río del oriente de El Salvador"),
            fallbackRiver("fallback-river:sensunapan", "Río Sensunapán", 13.710, -89.720, "Río del occidente de El Salvador")
    );

    public Map<String, Object> listar(String tipo, String q, int page, int size) {
        String t = normalizeTipo(tipo);
        List<Map<String, Object>> base = getOrFetch(t);

        List<Map<String, Object>> filtered = base;
        String query = q == null ? "" : q.trim();
        if (!query.isBlank()) {
            String needle = normalizeText(query);
            filtered = base.stream()
                    .filter(row -> normalizeText(String.valueOf(row.getOrDefault("nombre", ""))).contains(needle))
                    .toList();
        }

        int p = Math.max(0, page);
        int s = Math.max(1, Math.min(size, 50));
        int total = filtered.size();
        int from = Math.min(total, p * s);
        int to = Math.min(total, from + s);
        List<Map<String, Object>> items = from >= to ? List.of() : filtered.subList(from, to);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tipo", t);
        out.put("page", p);
        out.put("size", s);
        out.put("total", total);
        out.put("items", items);
        return out;
    }

    private List<Map<String, Object>> getOrFetch(String tipo) {
        CacheEntry ce = cache.get(tipo);
        long now = System.currentTimeMillis();
        if (ce != null && now - ce.storedAtMs() < TTL_MS) return ce.items();

        synchronized (("EcoPlacesService:" + tipo).intern()) {
            CacheEntry ce2 = cache.get(tipo);
            if (ce2 != null && now - ce2.storedAtMs() < TTL_MS) return ce2.items();

            List<Map<String, Object>> items = fetchFromOverpass(tipo);
            if (!items.isEmpty()) {
                cache.put(tipo, new CacheEntry(System.currentTimeMillis(), items));
            }
            return items;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchFromOverpass(String tipo) {
        try {
            String query = buildOverpassQueryForElSalvador(tipo);
            String body = "data=" + java.net.URLEncoder.encode(query, StandardCharsets.UTF_8);

            String raw = webClientBuilder.build()
                    .post()
                    .uri(overpassUrl)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofMinutes(4));

            Map<String, Object> json = mapper.readValue(raw, Map.class);
            List<Map<String, Object>> elements = (List<Map<String, Object>>) json.getOrDefault("elements", Collections.emptyList());

            Map<String, Map<String, Object>> unique = new LinkedHashMap<>();
            for (Map<String, Object> el : elements) {
                String osmType = String.valueOf(el.get("type"));
                Object idObj = el.get("id");
                if (idObj == null) continue;

                Map<String, Object> tags = (Map<String, Object>) el.get("tags");
                if (tags == null || tags.isEmpty()) continue;

                String name = displayName(tipo, idObj, tags);

                Double lat = null;
                Double lng = null;
                if ("node".equals(osmType)) {
                    Object la = el.get("lat");
                    Object lo = el.get("lon");
                    if (la instanceof Number n1 && lo instanceof Number n2) {
                        lat = n1.doubleValue();
                        lng = n2.doubleValue();
                    }
                } else {
                    Map<String, Object> center = (Map<String, Object>) el.get("center");
                    if (center != null) {
                        Object la = center.get("lat");
                        Object lo = center.get("lon");
                        if (la instanceof Number n1 && lo instanceof Number n2) {
                            lat = n1.doubleValue();
                            lng = n2.doubleValue();
                        }
                    }
                }
                if (lat == null || lng == null) continue;

                String key = osmType + ":" + idObj;
                if (unique.containsKey(key)) continue;

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("osm_type", osmType);
                row.put("osm_id", idObj);
                row.put("nombre", name);
                row.put("tipo", tipo);
                row.put("lat", lat);
                row.put("lng", lng);
                row.put("tags", tags);
                unique.put(key, row);
            }

            List<Map<String, Object>> out = new ArrayList<>(unique.values());
            out.sort(Comparator.comparing(o -> String.valueOf(o.getOrDefault("nombre", ""))));
            if (out.isEmpty() && "rios".equals(tipo)) return RIOS_FALLBACK;
            return out;
        } catch (Exception e) {
            log.error("EcoPlaces Overpass error ({}) : {}", tipo, e.getMessage());
            if ("rios".equals(tipo)) return RIOS_FALLBACK;
            return List.of();
        }
    }

    private static String buildOverpassQueryForElSalvador(String tipo) {
        // Por SV; rios/lagos/parques suelen omitir nombre en OSM (no usar ["name"] ahí).
        String selectors = switch (tipo) {
            case "playas" -> """
                node["natural"="beach"]["name"](area.a);
                way["natural"="beach"]["name"](area.a);
                relation["natural"="beach"]["name"](area.a);
                """;
            case "rios" -> """
                way["waterway"="river"]["name"](area.a);
                relation["waterway"="river"]["name"](area.a);
                way["natural"="water"]["water"~"^(river|riverbank)$"]["name"](area.a);
                relation["natural"="water"]["water"~"^(river|riverbank)$"]["name"](area.a);
                """;
            case "lagos" -> """
                way["natural"="water"]["water"="lake"](area.a);
                relation["natural"="water"]["water"="lake"](area.a);
                """;
            case "parques" -> """
                node["leisure"~"^(park|nature_reserve)$"](area.a);
                way["leisure"~"^(park|nature_reserve)$"](area.a);
                relation["boundary"="protected_area"](area.a);
                """;
            case "volcanes" -> """
                node["natural"="volcano"]["name"](area.a);
                way["natural"="volcano"]["name"](area.a);
                relation["natural"="volcano"]["name"](area.a);
                """;
            case "montanas" -> """
                node["natural"="peak"]["name"](area.a);
                way["natural"="peak"]["name"](area.a);
                relation["natural"="peak"]["name"](area.a);
                """;
            case "cascadas" -> """
                node["waterway"="waterfall"]["name"](area.a);
                way["waterway"="waterfall"]["name"](area.a);
                relation["waterway"="waterfall"]["name"](area.a);
                """;
            case "montanas-parques" -> """
                node["natural"="peak"]["name"](area.a);
                way["natural"="peak"]["name"](area.a);
                relation["natural"="peak"]["name"](area.a);
                node["leisure"="nature_reserve"]["name"](area.a);
                way["leisure"="nature_reserve"]["name"](area.a);
                relation["leisure"="nature_reserve"]["name"](area.a);
                way["boundary"="protected_area"]["name"](area.a);
                relation["boundary"="protected_area"]["name"](area.a);
                """;
            default -> "";
        };

        return """
            [out:json][timeout:180];
            area["ISO3166-1"="SV"][admin_level=2]->.a;
            (
            %s
            );
            out center;
            """.formatted(selectors);
    }

    private static String normalizeTipo(String raw) {
        String t = raw == null ? "" : raw.trim().toLowerCase();
        t = Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        if (t.equals("playa")) return "playas";
        if (t.equals("rio")) return "rios";
        if (t.equals("lago")) return "lagos";
        if (t.equals("parque")) return "parques";
        if (t.equals("volcan")) return "volcanes";
        if (t.equals("montana")) return "montanas";
        if (t.equals("cascada")) return "cascadas";

        // Default si viene vacío o desconocido
        if (t.isBlank()) return "playas";
        return t;
    }

    private static String normalizeText(String raw) {
        String t = raw == null ? "" : raw.trim().toLowerCase();
        t = Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return t;
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

    private static Map<String, Object> fallbackRiver(String id, String nombre, double lat, double lng, String descripcion) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("name", nombre);
        tags.put("waterway", "river");
        tags.put("description", descripcion);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("osm_type", "fallback");
        row.put("osm_id", id);
        row.put("nombre", nombre);
        row.put("tipo", "rios");
        row.put("lat", lat);
        row.put("lng", lng);
        row.put("tags", tags);
        return row;
    }

    /** Ríos/parques sin name:* muestran un label sintético para listados */
    private static String displayName(String tipo, Object idObj, Map<String, Object> tags) {
        String n = firstString(tags, "name:es", "name");
        if (n != null && !n.isBlank()) return n;
        String id = String.valueOf(idObj);
        return switch (tipo) {
            case "rios" -> {
                String ref = firstString(tags, "ref");
                yield ref != null ? "Río " + ref : "Río #" + id;
            }
            case "lagos" -> "Lago #" + id;
            case "parques" -> {
                String pc = firstString(tags, "protect_class");
                yield pc != null ? "Zona #" + id + " (" + pc + ')' : "Parque o zona #" + id;
            }
            default -> "Lugar #" + id;
        };
    }
}

