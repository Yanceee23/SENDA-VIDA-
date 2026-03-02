package com.sendavida.repository;
import com.sendavida.models.Hidratacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface HidratacionRepository extends JpaRepository<Hidratacion, Long> {
    List<Hidratacion> findByUsuarioId(Long usuarioId);
    List<Hidratacion> findByUsuarioIdAndCompletadoFalse(Long usuarioId);
}
