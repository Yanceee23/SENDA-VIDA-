package com.sendavida.repository;
import com.sendavida.models.Recomendacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface RecomendacionRepository extends JpaRepository<Recomendacion, Long> {
    Optional<Recomendacion> findByRutaId(Long rutaId);
}
