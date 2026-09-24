package com.example.agenda.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "avaliacao")
@Getter
@Setter
@NoArgsConstructor
public class Avaliacao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agendamento_id", nullable = false, unique = true)
    private Agendamento agendamento;

    @Column(nullable = false)
    private Integer nota;

    @Column(length = 1000)
    private String comentario;

    @CreationTimestamp
    @Column(name = "data_avaliacao", nullable = false, updatable = false)
    private LocalDateTime dataAvaliacao;
}
