package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity @Table(name = "recomendacion")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Recomendacion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ruta_id") private Ruta ruta;
    private String titulo;
    private String descripcion;
    @Column(name = "importancia_ecologica") private String importanciaEcologica;
    @Column(name = "estado_conservacion") private String estadoConservacion;
    @Column(name = "valor_natural") private String valorNatural;
    @Column(name = "especies_gbif", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String especiesGbif;
    @Column(name = "actualizado_en") private LocalDateTime actualizadoEn = LocalDateTime.now();
}
