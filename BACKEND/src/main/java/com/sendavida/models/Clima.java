package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name = "clima")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Clima {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ruta_id") private Ruta ruta;
    @Column(precision = 5, scale = 2) private BigDecimal temperatura;
    @Column(precision = 5, scale = 2) private BigDecimal humedad;
    private Boolean lluvia = false;
    private String alerta;
    private String condicion;
    @Column(name = "calidad_aire") private String calidadAire;
    @Column(name = "fecha_registro") private LocalDateTime fechaRegistro = LocalDateTime.now();
}
