package com.sendavida.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "estadistica")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Estadistica {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    private LocalDate fecha;

    @Column(name = "distancia_km", precision = 10, scale = 3)
    private BigDecimal distanciaKm = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2)
    private BigDecimal calorias = BigDecimal.ZERO;

    private String tipo;

    @Column(name = "creado_en")
    private LocalDateTime creadoEn = LocalDateTime.now();
}
