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
        return calcularCalorias(distanciaKm, pesoKg, tipoActividad, 0);
    }

    public double calcularCalorias(double distanciaKm, double pesoKg, String tipoActividad, int tiempoSegundos) {
        double factor = switch (tipoActividad == null ? "" : tipoActividad.toLowerCase()) {
            case "correr", "running" -> 1.05;
            case "bicicleta", "ciclismo", "cycling" -> 0.45;
            case "senderismo", "hiking" -> 0.70;
            case "caminar", "walking" -> 0.55;
            default -> 0.65;
        };
        double d = Math.max(0.0, distanciaKm);
        double p = Math.max(1.0, pesoKg);
        double kcalByDistance = d * p * factor;

        double seg = Math.max(0.0, tiempoSegundos);
        double hours = seg / 3600.0;
        if (hours <= 0.0 || d <= 0.0) return kcalByDistance;

        double speedKmh = d / Math.max(hours, 1.0 / 3600.0);
        boolean movingEnough = d >= 0.08 || speedKmh >= 1.2;
        if (!movingEnough) return kcalByDistance;

        double met = metBySpeed(tipoActividad, speedKmh);
        double kcalByTime = met * p * hours;
        double blended = kcalByDistance * 0.7 + kcalByTime * 0.3;
        double minSafe = kcalByDistance * 0.75;
        double maxSafe = kcalByDistance * 1.35 + 20.0;
        return Math.min(maxSafe, Math.max(minSafe, blended));
    }

    private double metBySpeed(String tipoActividad, double speedKmh) {
        String t = tipoActividad == null ? "" : tipoActividad.toLowerCase();
        double speed = Math.max(0.0, speedKmh);
        if ("bicicleta".equals(t) || "ciclismo".equals(t) || "cycling".equals(t)) {
            if (speed < 8.0) return 4.5;
            if (speed < 14.0) return 6.8;
            if (speed < 18.0) return 8.0;
            return 10.0;
        }
        if ("senderismo".equals(t) || "hiking".equals(t)) {
            if (speed < 3.0) return 4.5;
            if (speed < 5.0) return 5.5;
            return 6.8;
        }
        if ("correr".equals(t) || "running".equals(t)) {
            if (speed < 8.0) return 8.3;
            if (speed < 10.0) return 9.8;
            return 11.0;
        }
        if (speed < 3.0) return 2.8;
        if (speed < 5.0) return 3.8;
        return 4.8;
    }
}
