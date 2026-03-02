package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity @Table(name = "hidratacion")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Hidratacion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id") private Usuario usuario;
    private String recordatorio;
    private LocalDateTime tiempo;
    private Boolean completado = false;
}
