package com.sendavida.repository;
import com.sendavida.models.Reto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RetoRepository extends JpaRepository<Reto, Long> {
    List<Reto> findByUsuarioId(Long usuarioId);
    List<Reto> findByUsuarioIdAndEstado(Long usuarioId, String estado);
}
