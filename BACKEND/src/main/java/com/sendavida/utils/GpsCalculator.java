package com.sendavida.utils;

import org.springframework.stereotype.Component;

@Component
public class GpsCalculator {

    private static final double RADIO_TIERRA_KM = 6371.0088;

    public double distanciaKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return RADIO_TIERRA_KM * c;
    }

    /**
     * Estimación simple basada en distancia y peso.
     * (Se puede reemplazar por un cálculo con MET/tiempo si luego guardas velocidad/tiempo real.)
     */
    public double calcularCalorias(double distanciaKm, double pesoKg, String tipoActividad) {
        double factor = switch (tipoActividad == null ? "" : tipoActividad.toLowerCase()) {
            case "correr", "running" -> 1.05;
            case "bicicleta", "ciclismo", "cycling" -> 0.45;
            case "senderismo", "hiking" -> 0.70;
            case "caminar", "walking" -> 0.55;
            default -> 0.65;
        };
        double d = Math.max(0.0, distanciaKm);
        double p = Math.max(1.0, pesoKg);
        return d * p * factor;
    }
}
