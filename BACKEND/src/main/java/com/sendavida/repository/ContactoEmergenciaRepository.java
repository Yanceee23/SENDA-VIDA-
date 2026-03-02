package com.sendavida.repository;
import com.sendavida.models.ContactoEmergencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ContactoEmergenciaRepository extends JpaRepository<ContactoEmergencia, Long> {
    List<ContactoEmergencia> findByUsuarioId(Long usuarioId);
    List<ContactoEmergencia> findByUsuarioIdAndActivoTrue(Long usuarioId);
}
