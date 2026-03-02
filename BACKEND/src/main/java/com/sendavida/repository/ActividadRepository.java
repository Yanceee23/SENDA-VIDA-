package com.sendavida.repository;
import com.sendavida.models.Actividad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ActividadRepository extends JpaRepository<Actividad, Long> {
    List<Actividad> findByUsuarioId(Long usuarioId);
    Optional<Actividad> findByUsuarioIdAndEstado(Long usuarioId, String estado);
    List<Actividad> findByUsuarioIdOrderByIniciadaEnDesc(Long usuarioId);
}
