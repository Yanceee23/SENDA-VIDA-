package com.sendavida.repository;
import com.sendavida.models.Alimentacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AlimentacionRepository extends JpaRepository<Alimentacion, Long> {
    List<Alimentacion> findByUsuarioId(Long usuarioId);
}
