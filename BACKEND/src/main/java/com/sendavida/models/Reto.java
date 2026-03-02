package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "reto")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Reto {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id") private Usuario usuario;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ruta_id") private Ruta ruta;
    @Column(name = "tipo_reto") private String tipoReto;
    private Integer puntos = 10;
    private String estado = "pendiente";
}
