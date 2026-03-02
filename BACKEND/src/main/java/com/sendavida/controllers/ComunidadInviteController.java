package com.sendavida.controllers;

import com.sendavida.models.Comunidad;
import com.sendavida.services.ComunidadService;
import com.sendavida.utils.InviteTokenUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/comunidad")
@RequiredArgsConstructor
public class ComunidadInviteController {
    private final ComunidadService comunidadService;
    private final InviteTokenUtil inviteTokenUtil;

    @PostMapping("/grupos/{id}/invite")
    public ResponseEntity<?> inviteGrupo(@PathVariable Long id) {
        try {
            String token = inviteTokenUtil.generarInviteGrupo(id);
            String deepLink = "sendavida://join?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("groupId", id);
            res.put("token", token);
            res.put("deepLink", deepLink);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/invite/join")
    public ResponseEntity<?> joinByInvite(@RequestBody Map<String, Object> body) {
        try {
            String token = body.get("token") != null ? String.valueOf(body.get("token")) : null;
            if (token == null || token.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "token requerido"));

            Long groupId = inviteTokenUtil.extraerGrupoId(token);
            Comunidad c = comunidadService.unirseGrupo(groupId);

            Map<String, Object> res = new LinkedHashMap<>();
            res.put("joined", true);
            res.put("groupId", c.getId());
            res.put("nombreGrupo", c.getNombreGrupo());
            res.put("participantes", c.getParticipantes());
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

