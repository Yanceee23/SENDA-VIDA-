package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity @Table(name = "ubicacion_compartida")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class UbicacionCompartida {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id") private Usuario usuario;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ruta_id") private Ruta ruta;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actividad_id") private Actividad actividad;
    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String gps;
    @Column(name = "compartido_con", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String compartidoCon = "[]";
    private Boolean activa = true;
    private LocalDateTime timestamp = LocalDateTime.now();
}
