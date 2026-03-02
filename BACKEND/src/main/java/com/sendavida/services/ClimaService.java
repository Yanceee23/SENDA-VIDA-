package com.sendavida.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import java.util.*;

@Service @RequiredArgsConstructor @Slf4j
public class ClimaService {
    @Value("${openmeteo.url}") private String apiUrl;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper mapper;

    @SuppressWarnings("unchecked")
    public Map<String, Object> getClimaActual(double lat, double lng) {
        try {
            String url = apiUrl + "/forecast?latitude=" + lat + "&longitude=" + lng
                + "&current_weather=true"
                + "&hourly=precipitation,precipitation_probability,temperature_2m,relativehumidity_2m,windspeed_10m"
                + "&forecast_days=1&timezone=auto";
            String raw = webClientBuilder.build().get().uri(url)
                .retrieve().bodyToMono(String.class).block();
            Map<String, Object> json = mapper.readValue(raw, Map.class);
            Map<String, Object> resultado = new LinkedHashMap<>();

            Map<?, ?> current = (Map<?, ?>) json.get("current_weather");
            if (current != null) {
                resultado.put("temperatura", current.get("temperature"));
                resultado.put("temperaturaC", current.get("temperature"));
                resultado.put("viento_kmh", current.get("windspeed"));
                resultado.put("viento_dir", current.get("winddirection"));
                resultado.put("es_dia", current.get("is_day"));
                int code = current.get("weathercode") != null ? ((Number) current.get("weathercode")).intValue() : 0;
                resultado.put("weathercode", code);
                resultado.put("icono", iconoPorCodigo(code));
                resultado.put("condicion", traducirWeatherCode(code).trim());
            }
            Map<?, ?> hourly = (Map<?, ?>) json.get("hourly");
            if (hourly != null) {
                List<?> precip = (List<?>) hourly.get("precipitation");
                List<?> humedad = (List<?>) hourly.get("relativehumidity_2m");
                List<?> times = (List<?>) hourly.get("time");
                List<?> probPrecip = (List<?>) hourly.get("precipitation_probability");
                double precipActual = precip != null && !precip.isEmpty() ? ((Number) precip.get(0)).doubleValue() : 0.0;
                resultado.put("precipitacion_mm", precipActual);
                resultado.put("lluvia", precipActual > 0.1);
                if (humedad != null && !humedad.isEmpty()) resultado.put("humedad", humedad.get(0));
                Object cwTime = current != null ? current.get("time") : json.get("current_weather") != null
                    ? ((Map<?, ?>) json.get("current_weather")).get("time") : "";
                String nowIso = cwTime != null ? String.valueOf(cwTime) : "";
                if (times != null && probPrecip != null && !times.isEmpty() && !probPrecip.isEmpty()) {
                    int idx = 0;
                    for (int i = 0; i < times.size(); i++) {
                        if (String.valueOf(times.get(i)).compareTo(nowIso) >= 0) {
                            idx = i;
                            break;
                        }
                    }
                    List<Map<String, Object>> probLluvia = new ArrayList<>();
                    for (int i = 0; i < 8 && idx + i < times.size(); i++) {
                        Map<String, Object> h = new LinkedHashMap<>();
                        String t = String.valueOf(times.get(idx + i));
                        h.put("hora", t.length() >= 16 ? t.substring(11, 16) : t);
                        h.put("prob", probPrecip.get(idx + i) != null ? ((Number) probPrecip.get(idx + i)).doubleValue() : 0);
                        probLluvia.add(h);
                    }
                    resultado.put("probLluviaProximasHoras", probLluvia);
                }
            }
            String alerta = generarAlerta(resultado);
            resultado.put("alerta", alerta);
            resultado.put("hay_alerta", alerta != null);
            return resultado;
        } catch (Exception e) {
            log.error("Error Open-Meteo: {}", e.getMessage());
            return Map.of("error", "No se pudo obtener clima", "temperatura", 0, "lluvia", false, "alerta", null);
        }
    }

    public Mono<Map<String, Object>> getClimaActualAsync(double lat, double lng) {
        return Mono.fromCallable(() -> getClimaActual(lat, lng)).subscribeOn(Schedulers.boundedElastic());
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getPronostico7Dias(double lat, double lng) {
        try {
            String url = apiUrl + "/forecast?latitude=" + lat + "&longitude=" + lng
                + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode"
                + "&forecast_days=7&timezone=auto";
            String raw = webClientBuilder.build().get().uri(url)
                .retrieve().bodyToMono(String.class).block();
            Map<String, Object> json = mapper.readValue(raw, Map.class);
            Map<?, ?> daily = (Map<?, ?>) json.get("daily");
            List<?> fechas = (List<?>) daily.get("time");
            List<?> maxTemps = (List<?>) daily.get("temperature_2m_max");
            List<?> minTemps = (List<?>) daily.get("temperature_2m_min");
            List<?> precip = (List<?>) daily.get("precipitation_sum");
            List<?> codes = (List<?>) daily.get("weathercode");
            List<Map<String, Object>> resultado = new ArrayList<>();
            for (int i = 0; i < fechas.size(); i++) {
                Map<String, Object> dia = new LinkedHashMap<>();
                dia.put("fecha", fechas.get(i));
                dia.put("temp_max", maxTemps.get(i));
                dia.put("temp_min", minTemps.get(i));
                dia.put("precipitacion_mm", precip.get(i));
                dia.put("lluvia", precip.get(i) != null && ((Number) precip.get(i)).doubleValue() > 0.5);
                int code = codes.get(i) != null ? ((Number) codes.get(i)).intValue() : 0;
                dia.put("condicion", traducirWeatherCode(code));
                dia.put("weathercode", code);
                resultado.add(dia);
            }
            return resultado;
        } catch (Exception e) {
            log.error("Error pronóstico: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public boolean hayLluvia(Map<String, Object> clima) { return Boolean.TRUE.equals(clima.get("lluvia")); }
    public boolean calorExtremo(Map<String, Object> clima) {
        Object temp = clima.get("temperatura");
        return temp != null && Double.parseDouble(temp.toString()) > 35.0;
    }

    private String generarAlerta(Map<String, Object> c) {
        if (Boolean.TRUE.equals(c.get("lluvia"))) return " Lluvia detectada. Ten precaución.";
        Object temp = c.get("temperatura");
        if (temp != null && Double.parseDouble(temp.toString()) > 35) return " Calor extremo. Hidrátate constantemente.";
        Object viento = c.get("viento_kmh");
        if (viento != null && Double.parseDouble(viento.toString()) > 50) return " Viento fuerte. Cuidado en zonas altas.";
        return null;
    }

    private String iconoPorCodigo(int code) {
        if (code == 0) return "☀️";
        if (code >= 1 && code <= 3) return "⛅";
        if (code >= 45 && code <= 48) return "🌫️";
        if (code >= 51 && code <= 65) return "🌧️";
        if (code >= 80 && code <= 82) return "🌦️";
        if (code >= 95 && code <= 99) return "⛈️";
        return "⛅";
    }

    private String traducirWeatherCode(int code) {
        if (code == 0) return " Despejado";
        if (code <= 2) return " Parcialmente nublado";
        if (code == 3) return " Nublado";
        if (code >= 45 && code <= 48) return "🌫 Niebla";
        if (code >= 51 && code <= 55) return "🌦 Llovizna";
        if (code >= 61 && code <= 65) return "🌧 Lluvia";
        if (code >= 80 && code <= 82) return "🌦 Chubascos";
        if (code >= 95 && code <= 99) return "⛈ Tormenta eléctrica";
        return "🌡 Condición variable";
    }
}
