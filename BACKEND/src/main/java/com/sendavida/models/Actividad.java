package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name = "actividad")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Actividad {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id") private Usuario usuario;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ruta_id") private Ruta ruta;
    private String tipo;
    @Column(name = "distancia_recorrida", precision = 6, scale = 2)
    private BigDecimal distanciaRecorrida = BigDecimal.ZERO;
    @Column(precision = 6, scale = 2) private BigDecimal calorias = BigDecimal.ZERO;
    @Column(name = "tiempo_segundos") private Integer tiempoSegundos = 0;
    @Column(name = "gps_recorrido", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String gpsRecorrido;
    private String estado = "activa";
    @Column(name = "iniciada_en") private LocalDateTime iniciadaEn = LocalDateTime.now();
    @Column(name = "finalizada_en") private LocalDateTime finalizadaEn;
}
