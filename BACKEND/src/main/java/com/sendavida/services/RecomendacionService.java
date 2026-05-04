package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sendavida.utils.GpsCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.*;

@Service @RequiredArgsConstructor @Slf4j
public class RecomendacionService {
    private static final double KM_PER_DEGREE_LAT = 111.0;
    private static final int MAX_GBIF_RESULTS = 300;

    @Value("${gbif.url}") private String gbifUrl;
    @Value("${gbif.search-radius-km:1}") private double searchRadiusKm;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper mapper;
    private final GpsCalculator gpsCalculator;

    public Map<String, Object> getEspeciesGBIF(double lat, double lng, int limit) {
        try {
            Map<String, Object> res = new LinkedHashMap<>();
            Map<String, Object> floraData = queryGbifByKingdom(lat, lng, "Plantae", limit);
            Map<String, Object> faunaData = queryGbifByKingdom(lat, lng, "Animalia", limit);
            res.put("flora", floraData.getOrDefault("items", Collections.emptyList()));
            res.put("floraTotal", toInt(floraData.get("count")));
            res.put("fauna", faunaData.getOrDefault("items", Collections.emptyList()));
            res.put("faunaTotal", toInt(faunaData.get("count")));
            int floraTotal = toInt(floraData.get("count"));
            int faunaTotal = toInt(faunaData.get("count"));
            if (floraTotal == 0 && faunaTotal == 0) {
                log.info("GBIF devolvió 0 especies para lat={}, lng={}", lat, lng);
            }
            return res;
        } catch (Exception e) {
            log.error("Error GBIF: {}", e.getMessage());
            return Map.of(
                "flora", Collections.emptyList(),
                "floraTotal", 0,
                "fauna", Collections.emptyList(),
                "faunaTotal", 0
            );
        }
    }

    public Mono<Map<String, Object>> getEspeciesGBIFAsync(double lat, double lng) {
        return Mono.fromCallable(() -> getEspeciesGBIF(lat, lng, 15)).subscribeOn(Schedulers.boundedElastic());
    }

    public Map<String, Object> getDatosAmbientalesCompletos(double lat, double lng) {
        Map<String, Object> resultado = new LinkedHashMap<>();
        Map<String, Object> gbif = getEspeciesGBIF(lat, lng, 15);
        resultado.put("gbif", gbif);
        int flora = toInt(gbif.get("floraTotal"));
        int fauna = toInt(gbif.get("faunaTotal"));
        resultado.put("resumen_ambiental",
            String.format("Esta zona tiene aprox. %d especies vegetales y %d animales.", flora, fauna));
        resultado.put("recomendaciones", generarRecomendaciones(flora, fauna));
        return resultado;
    }

    /**
     * Construye un polígono WKT (bounding box) alrededor del punto para búsqueda por área.
     * GBIF usa orden longitud-latitud en WKT.
     */
    private String buildGeometryWkt(double lat, double lng) {
        double latDelta = searchRadiusKm / KM_PER_DEGREE_LAT;
        double lngDelta = searchRadiusKm / (KM_PER_DEGREE_LAT * Math.cos(Math.toRadians(lat)));
        double minLng = lng - lngDelta;
        double maxLng = lng + lngDelta;
        double minLat = lat - latDelta;
        double maxLat = lat + latDelta;
        return String.format("POLYGON((%.6f %.6f, %.6f %.6f, %.6f %.6f, %.6f %.6f, %.6f %.6f))",
            minLng, minLat, maxLng, minLat, maxLng, maxLat, minLng, maxLat, minLng, minLat);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> queryGbifByKingdom(double lat, double lng, String kingdom, int limit) throws Exception {
        String geometry = buildGeometryWkt(lat, lng);
        String url = UriComponentsBuilder.fromHttpUrl(gbifUrl + "/occurrence/search")
            .queryParam("kingdom", kingdom)
            .queryParam("geometry", geometry)
            .queryParam("hasCoordinate", true)
            .queryParam("hasGeospatialIssue", false)
            .queryParam("occurrenceStatus", "PRESENT")
            .queryParam("limit", MAX_GBIF_RESULTS)
            .build(true)
            .toUriString();

        String raw = webClientBuilder.build().get().uri(url)
            .header("User-Agent", "SendaVidaApp/1.0")
            .retrieve().bodyToMono(String.class).block();
        Map<String, Object> json = mapper.readValue(raw, Map.class);
        List<Map<String, Object>> results = (List<Map<String, Object>>) json.getOrDefault("results", Collections.emptyList());

        Set<String> nombres = new LinkedHashSet<>();
        for (Map<String, Object> occ : results) {
            Double occLat = toDouble(occ.get("decimalLatitude"));
            Double occLng = toDouble(occ.get("decimalLongitude"));
            if (occLat == null || occLng == null) continue;
            double distanciaKm = gpsCalculator.distanciaKm(lat, lng, occLat, occLng);
            if (distanciaKm > searchRadiusKm) continue;

            String species = occ.get("species") != null ? String.valueOf(occ.get("species")).trim() : "";
            String scientificName = occ.get("scientificName") != null ? String.valueOf(occ.get("scientificName")).trim() : "";
            String nombre = !species.isBlank() ? species : scientificName;
            if (!nombre.isBlank()) nombres.add(nombre);
        }

        int totalUniqueSpecies = nombres.size();
        List<Map<String, String>> items = nombres.stream()
            .limit(limit)
            .map(nombre -> Map.of("nombre", nombre))
            .toList();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("count", totalUniqueSpecies);
        data.put("items", items);
        return data;
    }

    private int toInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        if (value == null) return 0;
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Double toDouble(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        if (value == null) return null;
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private List<String> generarRecomendaciones(int flora, int fauna) {
        List<String> rec = new ArrayList<>();
        if (flora > 10) rec.add(" Alta diversidad vegetal — no arranques plantas.");
        if (fauna > 5) rec.add(" Zona con fauna — observa sin molestar a los animales.");
        if (flora == 0 && fauna == 0) rec.add("ℹ Sin datos de biodiversidad registrados en GBIF.");
        rec.add("♻ Lleva de vuelta toda tu basura.");
        rec.add(" Fotografía sin tocar — preserva el ecosistema.");
        return rec;
    }
}
