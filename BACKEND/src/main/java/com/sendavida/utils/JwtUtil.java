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
public class JwtUtil {

    @Value("${jwt.secret:change_me_please_change_me_please_change_me}")
    private String secret;

    @Value("${jwt.expirationMinutes:10080}")
    private long expirationMinutes;

    @Value("${jwt.issuer:SendaVida}")
    private String issuer;

    public String generar(Long userId, String correo) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(expirationMinutes * 60);
        return Jwts.builder()
            .setIssuer(issuer)
            .setSubject(correo)
            .setIssuedAt(Date.from(now))
            .setExpiration(Date.from(exp))
            .claim("userId", userId)
            .signWith(key(), SignatureAlgorithm.HS256)
            .compact();
    }

    public Long extraerUserId(String token) {
        Object v = parseClaims(token).get("userId");
        if (v instanceof Number n) return n.longValue();
        if (v != null) return Long.parseLong(v.toString());
        return null;
    }

    public String extraerCorreo(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean esValido(String token) {
        try {
            Claims c = parseClaims(token);
            Date exp = c.getExpiration();
            return exp == null || exp.after(new Date());
        } catch (Exception e) {
            return false;
        }
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
