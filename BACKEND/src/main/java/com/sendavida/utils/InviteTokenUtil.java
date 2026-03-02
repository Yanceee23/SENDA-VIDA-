package com.sendavida.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;

@Component
public class InviteTokenUtil {

    @Value("${jwt.secret:change_me_please_change_me_please_change_me}")
    private String secret;

    @Value("${invite.expirationMinutes:10080}") // 7 días por defecto
    private long inviteExpirationMinutes;

    public String generarInviteGrupo(Long grupoId) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(inviteExpirationMinutes * 60);
        return Jwts.builder()
            .setIssuer("SendaVidaInvite")
            .setSubject("group_invite")
            .setIssuedAt(Date.from(now))
            .setExpiration(Date.from(exp))
            .claim("groupId", grupoId)
            .signWith(key(), SignatureAlgorithm.HS256)
            .compact();
    }

    public Long extraerGrupoId(String token) {
        Claims c = parseClaims(token);
        if (!"group_invite".equals(c.getSubject())) throw new RuntimeException("Token inválido");
        Object v = c.get("groupId");
        if (v instanceof Number n) return n.longValue();
        if (v != null) return Long.parseLong(v.toString());
        throw new RuntimeException("Token inválido");
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
            .setSigningKey(key())
            .build()
            .parseClaimsJws(token)
            .getBody();
    }

    private SecretKey key() {
        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
        if (raw.length < 32) {
            try {
                raw = MessageDigest.getInstance("SHA-256").digest(raw);
            } catch (Exception ignored) {
                // fallback below
            }
        }
        return Keys.hmacShaKeyFor(raw);
    }
}

