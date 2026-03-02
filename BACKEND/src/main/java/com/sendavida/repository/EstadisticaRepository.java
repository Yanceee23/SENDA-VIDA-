package com.sendavida.repository;

import com.sendavida.models.Estadistica;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface EstadisticaRepository extends JpaRepository<Estadistica, Long> {
    List<Estadistica> findByUsuarioIdAndFecha(Long usuarioId, LocalDate fecha);
}
