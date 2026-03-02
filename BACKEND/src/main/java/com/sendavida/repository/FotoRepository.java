package com.sendavida.repository;
import com.sendavida.models.Foto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FotoRepository extends JpaRepository<Foto, Long> {
    List<Foto> findByUsuarioIdOrderByHoraDesc(Long usuarioId);
    List<Foto> findByActividadId(Long actividadId);
}
