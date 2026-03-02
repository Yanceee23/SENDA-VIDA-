package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.*;

@Service @RequiredArgsConstructor @Slf4j
public class RutaService {
    @Value("${overpass.url}") private String overpassUrl;
    @Value("${wikidata.url}") private String wikidataUrl;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper mapper;

    @SuppressWarnings("unchecked")
    public Map<String, Object> verificarZonaProtegida(double lat, double lng, int radioMetros) {
        try {
            String query = String.format(
                "[out:json][timeout:25];(node[\"leisure\"=\"nature_reserve\"](around:%d,%s,%s);"
                + "way[\"leisure\"=\"nature_reserve\"](around:%d,%s,%s);"
                + "node[\"boundary\"=\"protected_area\"](around:%d,%s,%s);"
                + "node[\"landuse\"=\"forest\"](around:%d,%s,%s);"
                + "node[\"leisure\"=\"park\"](around:%d,%s,%s););out body;",
                radioMetros, lat, lng, radioMetros, lat, lng,
                radioMetros, lat, lng, radioMetros, lat, lng, radioMetros, lat, lng);
            String body = "data=" + java.net.URLEncoder.encode(query, StandardCharsets.UTF_8);
            String raw = webClientBuilder.build().post().uri(overpassUrl)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .bodyValue(body).retrieve().bodyToMono(String.class).block();
            Map<String, Object> json = mapper.readValue(raw, Map.class);
            List<Map<String, Object>> elements = (List<Map<String, Object>>) json.getOrDefault("elements", Collections.emptyList());

            Map<String, Object> resultado = new LinkedHashMap<>();
            boolean esProtegida = !elements.isEmpty();
            resultado.put("es_area_protegida", esProtegida);
            if (esProtegida) {
                String nombreArea = null, tipoArea = null;
                for (Map<String, Object> el : elements) {
                    Map<?, ?> tags = (Map<?, ?>) el.get("tags");
                    if (tags != null) {
                        if (tags.get("name") != null) nombreArea = (String) tags.get("name");
                        if (tags.get("leisure") != null) tipoArea = (String) tags.get("leisure");
                        else if (tags.get("boundary") != null) tipoArea = (String) tags.get("boundary");
                        if (nombreArea != null) break;
                    }
                }
                String nombre = nombreArea != null ? nombreArea : "Área Natural Protegida";
                resultado.put("nombre_area", nombre);
                resultado.put("tipo_area", tipoArea);
                resultado.put("alerta", " Estás en zona protegida: " + nombre + ". Respeta la flora y fauna local.");
            }
            return resultado;
        } catch (Exception e) {
            log.error("Error Overpass: {}", e.getMessage());
            return Map.of("es_area_protegida", false);
        }
    }

    public Mono<Map<String, Object>> verificarZonaProtegidaAsync(double lat, double lng) {
        return Mono.fromCallable(() -> verificarZonaProtegida(lat, lng, 1000)).subscribeOn(Schedulers.boundedElastic());
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getDatosWikidata(String nombreLugar, String tipo) {
        try {
            String sparql = construirSparql(nombreLugar, tipo);
            String encoded = java.net.URLEncoder.encode(sparql, StandardCharsets.UTF_8);
            String url = wikidataUrl + "?query=" + encoded + "&format=json";
            String raw = webClientBuilder.build().get().uri(url)
                .header("Accept", "application/sparql-results+json")
                .header("User-Agent", "SendaVidaApp/1.0")
                .retrieve().bodyToMono(String.class).block();
            Map<String, Object> json = mapper.readValue(raw, Map.class);
            Map<String, Object> results = (Map<String, Object>) json.get("results");
            List<Map<String, Object>> bindings = (List<Map<String, Object>>) results.get("bindings");
            if (bindings == null || bindings.isEmpty())
                return Map.of(
                        "nombre", nombreLugar,
                        "tipo", tipo,
                        "label", nombreLugar,
                        "description", "No encontrado en Wikidata",
                        "nota", "No encontrado en Wikidata"
                );
            Map<String, Object> resultado = new LinkedHashMap<>();
            resultado.put("nombre", nombreLugar);
            resultado.put("tipo", tipo);
            Map<String, Object> row = bindings.get(0);
            for (Map.Entry<String, Object> entry : row.entrySet()) {
                Map<?, ?> vm = (Map<?, ?>) entry.getValue();
                resultado.put(entry.getKey(), vm.get("value"));
            }

            // Compatibilidad con el móvil: llaves esperadas `label` y `description`.
            Object lugarLabel = resultado.get("lugarLabel");
            if (lugarLabel != null) resultado.putIfAbsent("label", lugarLabel);
            if (resultado.get("description") == null && resultado.get("descripcion") != null) {
                resultado.put("description", resultado.get("descripcion"));
            }
            return resultado;
        } catch (Exception e) {
            log.error("Error Wikidata: {}", e.getMessage());
            return Map.of(
                    "nombre", nombreLugar,
                    "tipo", tipo,
                    "label", nombreLugar,
                    "description", "Wikidata no disponible",
                    "error", "Wikidata no disponible"
            );
        }
    }

    public Mono<Map<String, Object>> getDatosWikidataAsync(String nombre, String tipo) {
        return Mono.fromCallable(() -> getDatosWikidata(nombre, tipo)).subscribeOn(Schedulers.boundedElastic());
    }

    private String construirSparql(String nombre, String tipo) {
        String nombreEsc = escapeSparqlLiteral(nombre);
        String t = normalizeTipo(tipo);
        String tipoQ = switch (t) {
            case "volcan", "volcanes" -> "Q8072";
            case "rio", "rios" -> "Q4022";
            case "cascada", "cascadas" -> "Q35872";
            case "playa", "playas" -> "Q40080";
            case "parque", "parques" -> "Q22698";
            case "lago", "lagos" -> "Q23397";
            case "montana", "montanas" -> "Q8502";
            default -> "Q8502";
        };

        return ""
                + "PREFIX wd: <http://www.wikidata.org/entity/>\n"
                + "PREFIX wdt: <http://www.wikidata.org/prop/direct/>\n"
                + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n"
                + "PREFIX schema: <http://schema.org/>\n"
                + "PREFIX wikibase: <http://wikiba.se/ontology#>\n"
                + "PREFIX bd: <http://www.bigdata.com/rdf#>\n"
                + "SELECT ?lugar ?lugarLabel ?description ?altura ?longitud ?coordenadas ?paisLabel WHERE {\n"
                + "  ?lugar wdt:P31 wd:" + tipoQ + " .\n"
                + "  ?lugar rdfs:label ?lugarLabel .\n"
                + "  FILTER(lang(?lugarLabel) = \"es\")\n"
                + "  FILTER(CONTAINS(LCASE(STR(?lugarLabel)), LCASE(\"" + nombreEsc + "\")))\n"
                + "  OPTIONAL { ?lugar schema:description ?description . FILTER(lang(?description) = \"es\") }\n"
                + "  OPTIONAL { ?lugar wdt:P2044 ?altura . }\n"
                + "  OPTIONAL { ?lugar wdt:P2043 ?longitud . }\n"
                + "  OPTIONAL { ?lugar wdt:P625 ?coordenadas . }\n"
                + "  OPTIONAL { ?lugar wdt:P17 ?pais . }\n"
                + "  SERVICE wikibase:label { bd:serviceParam wikibase:language \"es,en\" . }\n"
                + "} LIMIT 1";
    }

    private static String normalizeTipo(String raw) {
        if (raw == null) return "";
        String t = raw.trim().toLowerCase();
        t = Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return t;
    }

    private static String escapeSparqlLiteral(String raw) {
        if (raw == null) return "";
        // Evita romper el SPARQL (comillas, backslash, saltos de línea)
        return raw
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", " ")
                .trim();
    }
}

