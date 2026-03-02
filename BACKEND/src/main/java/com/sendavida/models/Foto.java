package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity @Table(name = "foto")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Foto {
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
    @Column(name = "url_foto", nullable = false) private String urlFoto;
    @Column(name = "nombre_lugar") private String nombreLugar;
    private LocalDateTime hora = LocalDateTime.now();
}
