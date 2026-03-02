package com.sendavida.repository;
import com.sendavida.models.UbicacionCompartida;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UbicacionCompartidaRepository extends JpaRepository<UbicacionCompartida, Long> {
    Optional<UbicacionCompartida> findByActividadIdAndActivaTrue(Long actividadId);
    Optional<UbicacionCompartida> findByUsuarioIdAndActivaTrue(Long usuarioId);
}
