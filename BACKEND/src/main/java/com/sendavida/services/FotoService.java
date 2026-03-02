package com.sendavida.services;

import com.sendavida.models.*;
import com.sendavida.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class FotoService {
    private final FotoRepository fotoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ActividadRepository actividadRepository;
    private final RutaRepository rutaRepository;
    private final GeoService geoService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public List<Foto> getFotos(Long usuarioId) {
        return fotoRepository.findByUsuarioIdOrderByHoraDesc(usuarioId);
    }

    public List<Foto> getFotosPorActividad(Long actividadId) {
        return fotoRepository.findByActividadId(actividadId);
    }

    public Foto guardar(Long usuarioId, String urlFoto, double lat, double lng,
                        Long actividadId, Long rutaId, String nombreLugar) {
        Usuario u = usuarioRepository.findById(usuarioId)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Foto foto = new Foto();
        foto.setUsuario(u);
        foto.setUrlFoto(urlFoto);
        foto.setGps(String.format("{\"lat\":%s,\"lng\":%s}", lat, lng));
        String nombre = nombreLugar != null && !nombreLugar.isBlank() ? nombreLugar.trim() : resolverNombreLugar(lat, lng);
        foto.setNombreLugar(nombre);
        if (actividadId != null)
            actividadRepository.findById(actividadId).ifPresent(foto::setActividad);
        if (rutaId != null)
            rutaRepository.findById(rutaId).ifPresent(foto::setRuta);
        return fotoRepository.save(foto);
    }

    public Foto guardarConArchivo(
            Long usuarioId,
            MultipartFile file,
            double lat,
            double lng,
            Long actividadId,
            Long rutaId,
            String nombreLugar
    ) {
        try {
            if (file == null || file.isEmpty()) {
                throw new RuntimeException("Archivo vacío");
            }

            String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
            String ext = contentType.contains("png") ? ".png" : ".jpg";

            Path dir = Paths.get(uploadDir, "fotos").toAbsolutePath().normalize();
            Files.createDirectories(dir);

            String filename = UUID.randomUUID() + ext;
            Path target = dir.resolve(filename);
            file.transferTo(target);

            String urlFoto = "/uploads/fotos/" + filename;
            return guardar(usuarioId, urlFoto, lat, lng, actividadId, rutaId, nombreLugar);
        } catch (Exception e) {
            throw new RuntimeException("No se pudo guardar la foto: " + e.getMessage(), e);
        }
    }

    public List<Map<String, Object>> getFotosDto(Long usuarioId) {
        List<Foto> list = getFotos(usuarioId);
        return list.stream().map(f -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", f.getId());
            row.put("urlFoto", f.getUrlFoto());
            row.put("gps", f.getGps());
            row.put("hora", f.getHora() != null ? f.getHora().toString() : null);
            row.put("nombreLugar", f.getNombreLugar());
            return row;
        }).toList();
    }

    public Map<String, Object> eliminar(Long id) {
        fotoRepository.deleteById(id);
        return Map.of("eliminado", true, "id", id);
    }

    private String resolverNombreLugar(double lat, double lng) {
        try {
            Map<String, Object> res = geoService.reverse(lat, lng);
            if (res == null) return "Lugar";
            String barrio = toText(res.get("barrio"));
            if (!barrio.isBlank()) return barrio;
            String ciudad = toText(res.get("ciudad"));
            if (!ciudad.isBlank()) return ciudad;
            String region = toText(res.get("region"));
            if (!region.isBlank()) return region;
            String pais = toText(res.get("pais"));
            if (!pais.isBlank()) return pais;
            return "Lugar";
        } catch (Exception e) {
            return "Lugar";
        }
    }

    private static String toText(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}