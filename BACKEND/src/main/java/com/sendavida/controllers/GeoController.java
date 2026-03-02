package com.sendavida.controllers;

import com.sendavida.services.GeoService;
import com.sendavida.services.EcoPlacesService;
import com.sendavida.services.PoisService;
import com.sendavida.services.RoutingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/geo")
@RequiredArgsConstructor
public class GeoController {
    private final GeoService geoService;
    private final EcoPlacesService ecoPlacesService;
    private final PoisService poisService;
    private final RoutingService routingService;

    @GetMapping("/reverse")
    public ResponseEntity<?> reverse(@RequestParam double lat, @RequestParam double lng) {
        try {
            Map<String, Object> res = geoService.reverse(lat, lng);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/pois")
    public ResponseEntity<?> pois(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false, defaultValue = "5000") int radiusM,
            @RequestParam(required = false, defaultValue = "20") int limit
    ) {
        try {
            List<Map<String, Object>> res = poisService.nearby(lat, lng, radiusM, limit);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q, @RequestParam(required = false, defaultValue = "5") int limit) {
        try {
            return ResponseEntity.ok(geoService.search(q, limit));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/route")
    public ResponseEntity<?> route(
            @RequestParam double startLat,
            @RequestParam double startLng,
            @RequestParam double endLat,
            @RequestParam double endLng,
            @RequestParam(required = false, defaultValue = "walking") String profile
    ) {
        try {
            return ResponseEntity.ok(routingService.route(profile, startLat, startLng, endLat, endLng));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/ecolugares")
    public ResponseEntity<?> ecoLugares(
            @RequestParam String tipo,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "30") int size
    ) {
        try {
            return ResponseEntity.ok(ecoPlacesService.listar(tipo, q, page, size));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

