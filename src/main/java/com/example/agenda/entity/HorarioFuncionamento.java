package com.example.agenda.entity;

import com.example.agenda.entity.enums.DiaSemana;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(
        name = "horario_funcionamento",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_horario_funcionamento_prestador_dia",
                columnNames = {"prestador_id", "dia_semana"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class HorarioFuncionamento {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prestador_id", nullable = false)
    private Prestador prestador;

    @Enumerated(EnumType.STRING)
    @Column(name = "dia_semana", nullable = false, length = 3)
    private DiaSemana diaSemana;

    @Column(name = "hora_inicio", nullable = false)
    private LocalTime horaInicio;

    @Column(name = "hora_fim", nullable = false)
    private LocalTime horaFim;

    @Column(name = "intervalo_inicio")
    private LocalTime intervaloInicio;

    @Column(name = "intervalo_fim")
    private LocalTime intervaloFim;
}
