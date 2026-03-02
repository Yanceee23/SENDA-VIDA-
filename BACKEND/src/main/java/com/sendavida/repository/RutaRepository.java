package com.sendavida.repository;
import com.sendavida.models.Ruta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RutaRepository extends JpaRepository<Ruta, Long> {
    List<Ruta> findByTipoIgnoreCase(String tipo);

    @Query("select r from Ruta r where lower(r.tipo) in :tipos")
    List<Ruta> findByTipoInLower(@Param("tipos") List<String> tipos);
    List<Ruta> findByAreaProtegidaTrue();
}
