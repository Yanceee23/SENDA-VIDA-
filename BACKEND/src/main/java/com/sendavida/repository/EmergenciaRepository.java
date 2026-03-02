package com.sendavida.repository;
import com.sendavida.models.Emergencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EmergenciaRepository extends JpaRepository<Emergencia, Long> {
    List<Emergencia> findByUsuarioIdOrderByFechaDesc(Long usuarioId);
}
