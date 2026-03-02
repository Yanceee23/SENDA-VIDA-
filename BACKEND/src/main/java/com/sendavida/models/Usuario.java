package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity @Table(name = "usuario")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Usuario {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 100) private String nombre;
    private Integer edad;
    @Column(name = "altura_cm") private Integer altura;
    @Column(precision = 5, scale = 2) private BigDecimal peso;
    @Column(unique = true, nullable = false, length = 100) private String correo;
    @Column(nullable = false) private String password;
    private String foto;
    private String genero;
    private String preferencia;
    @Column(name = "puntos_eco") private Integer puntosEco = 0;
    @Column(name = "fcm_token") private String fcmToken;
    @Column(name = "creado_en") private LocalDateTime creadoEn = LocalDateTime.now();
    @OneToMany(mappedBy = "usuario", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ContactoEmergencia> contactosEmergencia;
}
