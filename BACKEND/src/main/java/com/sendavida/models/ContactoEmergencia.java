package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "contacto_emergencia")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ContactoEmergencia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id") private Usuario usuario;
    @Column(nullable = false, length = 100) private String nombre;
    @Column(nullable = false, length = 20) private String telefono;
    private String parentesco;
    private boolean activo = true;
}
