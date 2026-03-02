package com.sendavida.controllers;

import com.sendavida.models.Comunidad;
import com.sendavida.services.ComunidadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/grupos")
@RequiredArgsConstructor
public class GrupoCodigoController {
    private final ComunidadService comunidadService;

    @GetMapping("/codigo/{codigo}")
    public ResponseEntity<?> getGrupoPorCodigo(@PathVariable String codigo) {
        try {
            Comunidad grupo = comunidadService.buscarGrupoPorCodigo(codigo);
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("id", grupo.getId());
            res.put("nombreGrupo", grupo.getNombreGrupo());
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Código inválido o expirado."));
        }
    }
}
