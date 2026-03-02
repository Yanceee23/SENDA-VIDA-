package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity @Table(name = "emergencia")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Emergencia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id") private Usuario usuario;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ruta_id") private Ruta ruta;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actividad_id") private Actividad actividad;
    @Column(nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String ubicacion;
    private String tipo;
    private String estado = "activa";
    private LocalDateTime fecha = LocalDateTime.now();
}
