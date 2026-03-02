package com.sendavida.services;

import com.sendavida.models.Usuario;
import com.sendavida.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

@Service @RequiredArgsConstructor
public class UsuarioService {
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public Usuario buscarPorId(Long id) {
        return usuarioRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }

    public Usuario buscarPorCorreo(String correo) {
        return usuarioRepository.findByCorreo(correo)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }

    public Map<String, Object> getPerfil(Long id) {
        Usuario u = buscarPorId(id);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", u.getId());
        res.put("nombre", u.getNombre());
        res.put("correo", u.getCorreo());
        res.put("edad", u.getEdad());
        res.put("altura", u.getAltura());
        res.put("peso", u.getPeso());
        res.put("foto", u.getFoto());
        res.put("genero", u.getGenero());
        res.put("preferencia", u.getPreferencia());
        res.put("puntosEco", u.getPuntosEco() != null ? u.getPuntosEco() : 0);
        res.put("creadoEn", u.getCreadoEn());
        return res;
    }

    public Usuario actualizar(Long id, Map<String, Object> datos) {
        Usuario u = buscarPorId(id);
        if (datos.get("nombre") != null) u.setNombre((String) datos.get("nombre"));
        if (datos.get("peso") != null) u.setPeso(new BigDecimal(datos.get("peso").toString()));
        if (datos.get("edad") != null) u.setEdad(((Number) datos.get("edad")).intValue());
        if (datos.get("altura") != null) u.setAltura(((Number) datos.get("altura")).intValue());
        if (datos.get("foto") != null) u.setFoto((String) datos.get("foto"));
        if (datos.get("genero") != null) u.setGenero((String) datos.get("genero"));
        if (datos.get("preferencia") != null) u.setPreferencia((String) datos.get("preferencia"));
        return usuarioRepository.save(u);
    }

    public Usuario actualizarFcmToken(Long userId, String token) {
        Usuario u = buscarPorId(userId);
        u.setFcmToken(token);
        return usuarioRepository.save(u);
    }

    public Usuario sumarPuntosEco(Long userId, int puntos) {
        Usuario u = buscarPorId(userId);
        u.setPuntosEco((u.getPuntosEco() != null ? u.getPuntosEco() : 0) + puntos);
        return usuarioRepository.save(u);
    }

    public Map<String, Object> cambiarPassword(Long userId, String actual, String nueva) {
        Usuario u = buscarPorId(userId);
        if (!passwordEncoder.matches(actual, u.getPassword()))
            throw new RuntimeException("Contraseña actual incorrecta");
        u.setPassword(passwordEncoder.encode(nueva));
        usuarioRepository.save(u);
        return Map.of("actualizado", true);
    }
}

