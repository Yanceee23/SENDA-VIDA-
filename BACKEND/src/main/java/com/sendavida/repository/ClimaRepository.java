package com.sendavida.repository;
import com.sendavida.models.Clima;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ClimaRepository extends JpaRepository<Clima, Long> {
    List<Clima> findByRutaIdOrderByFechaRegistroDesc(Long rutaId);
}
