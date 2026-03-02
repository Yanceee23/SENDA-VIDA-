package com.sendavida.models;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "comunidad")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Comunidad {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "nombre_grupo", nullable = false) private String nombreGrupo;
    private String descripcion;
    private Integer participantes = 0;
    @Column(name = "codigo_invitacion", length = 6, unique = true)
    private String codigoInvitacion;
    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) private String mensajes = "[]";
}
