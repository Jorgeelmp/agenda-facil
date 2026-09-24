package com.example.agenda.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "prestador")
@Getter
@Setter
@NoArgsConstructor
public class Prestador {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false, unique = true)
    private Usuario usuario;

    @Column(name = "nome_negocio", nullable = false, length = 150)
    private String nomeNegocio;

    @Column(length = 500)
    private String descricao;

    private String endereco;

    @Column(name = "telefone_comercial", length = 20)
    private String telefoneComercial;
}
