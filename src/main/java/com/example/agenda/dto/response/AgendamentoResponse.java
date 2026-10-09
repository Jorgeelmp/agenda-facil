package com.example.agenda.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.StatusAgendamento;

public record AgendamentoResponse(UUID id, UUID clienteId, String clienteNome,
                                  UUID prestadorId, String prestadorNome,
                                  UUID servicoId, String servicoNome, Integer duracaoMinutos, BigDecimal preco,
                                  LocalDateTime dataHora, LocalDateTime dataHoraFim,
                                  StatusAgendamento status, String observacoes, LocalDateTime criadoEm) {

    public static AgendamentoResponse fromEntity(Agendamento agendamento) {
        Usuario cliente = agendamento.getCliente();
        Servico servico = agendamento.getServico();
        Prestador prestador = servico.getPrestador();
        return new AgendamentoResponse(agendamento.getId(), cliente.getId(), cliente.getNome(),
                prestador.getId(), prestador.getNomeNegocio(),
                servico.getId(), servico.getNome(), servico.getDuracaoMinutos(), servico.getPreco(),
                agendamento.getDataHora(), agendamento.getDataHora().plusMinutes(servico.getDuracaoMinutos()),
                agendamento.getStatus(), agendamento.getObservacoes(), agendamento.getCriadoEm());
    }
}
