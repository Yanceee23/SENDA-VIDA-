package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name = "ruta")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Ruta {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 50) private String tipo;
    @Column(nullable = false, length = 100) private String nombre;
    @Column(name = "distancia_km", precision = 6, scale = 2) private BigDecimal distanciaKm;
    private String dificultad;
    @Column(name = "nivel_seguridad") private String nivelSeguridad;
    @Column(name = "puntos_eco") private Integer puntosEco = 0;
    @Column(precision = 6, scale = 2) private BigDecimal profundidad;
    @Column(precision = 6, scale = 2) private BigDecimal longitud;
    @Column(precision = 6, scale = 2) private BigDecimal ancho;
    @Column(precision = 6, scale = 2) private BigDecimal altura;
    @Column(name = "gps_inicio", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String gpsInicio;
    @Column(name = "gps_fin", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String gpsFin;
    @Column(name = "mapa_offline") private Boolean mapaOffline = false;
    @Column(name = "datos_wikidata", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String datosWikidata;
    @Column(name = "area_protegida") private Boolean areaProtegida = false;
    @Column(name = "nombre_area", length = 150) private String nombreArea;
    @Column(name = "creado_en") private LocalDateTime creadoEn = LocalDateTime.now();
}
