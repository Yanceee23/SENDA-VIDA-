package com.sendavida.repository;
import com.sendavida.models.Comunidad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ComunidadRepository extends JpaRepository<Comunidad, Long> {
    Optional<Comunidad> findByCodigoInvitacionIgnoreCase(String codigoInvitacion);
}
