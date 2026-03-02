package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity @Table(name = "alimentacion")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Alimentacion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id") private Usuario usuario;
    private String sugerencia;
    private LocalDateTime tiempo;
    private Boolean completado = false;
}
