package com.sendavida.services;

import com.sendavida.models.Usuario;
import com.sendavida.repository.UsuarioRepository;
import com.sendavida.utils.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

@Service @RequiredArgsConstructor
public class AuthService {
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public Map<String, Object> registrar(Map<String, Object> body) {
        String correo = (String) body.get("correo");
        if (usuarioRepository.existsByCorreo(correo))
            throw new RuntimeException("El correo ya está registrado");

        Usuario usuario = new Usuario();
        usuario.setNombre((String) body.get("nombre"));
        usuario.setCorreo(correo);
        usuario.setPassword(passwordEncoder.encode((String) body.get("password")));
        if (body.get("edad") != null) usuario.setEdad(((Number) body.get("edad")).intValue());
        if (body.get("altura") != null) usuario.setAltura(((Number) body.get("altura")).intValue());
        if (body.get("peso") != null) usuario.setPeso(new BigDecimal(body.get("peso").toString()));
        usuario.setGenero((String) body.getOrDefault("genero", "otro"));
        usuario.setPreferencia((String) body.getOrDefault("preferencia", "ambos"));
        usuario.setPuntosEco(0);

        Usuario saved = usuarioRepository.save(usuario);
        String token = jwtUtil.generar(saved.getId(), saved.getCorreo());
        return buildAuthResponse(saved, token);
    }

    public Map<String, Object> login(String correo, String password) {
        Usuario usuario = usuarioRepository.findByCorreo(correo)
            .orElseThrow(() -> new RuntimeException("Credenciales incorrectas"));
        if (!passwordEncoder.matches(password, usuario.getPassword()))
            throw new RuntimeException("Credenciales incorrectas");
        String token = jwtUtil.generar(usuario.getId(), usuario.getCorreo());
        return buildAuthResponse(usuario, token);
    }

    public Map<String, Object> actualizarFcmToken(Long userId, String fcmToken) {
        Usuario u = usuarioRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        u.setFcmToken(fcmToken);
        usuarioRepository.save(u);
        return Map.of("actualizado", true, "userId", userId);
    }

    private Map<String, Object> buildAuthResponse(Usuario u, String token) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("token", token);
        res.put("userId", u.getId());
        res.put("nombre", u.getNombre());
        res.put("correo", u.getCorreo());
        res.put("puntosEco", u.getPuntosEco() != null ? u.getPuntosEco() : 0);
        res.put("foto", u.getFoto());
        res.put("genero", u.getGenero());
        res.put("preferencia", u.getPreferencia());
        res.put("edad", u.getEdad());
        res.put("peso", u.getPeso());
        res.put("altura", u.getAltura());
        return res;
    }
}
