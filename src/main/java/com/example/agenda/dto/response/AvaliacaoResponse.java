package com.example.agenda.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.Avaliacao;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.Usuario;

public record AvaliacaoResponse(UUID id, 
                                UUID agendamentoId, 
                                UUID clienteId,
                                String clienteNome,
                                UUID prestadorId,
                                String prestadorNome,
                                UUID servicoId,
                                String servicoNome, 
                                LocalDateTime dataHoraAgendamento,
                                Integer nota,
                                String comentario, 
                                LocalDateTime dataAvaliacao) 
{
    public static AvaliacaoResponse fromEntity(Avaliacao avaliacao) {
        Agendamento agendamento = avaliacao.getAgendamento();
        Usuario cliente = agendamento.getCliente();
        Servico servico = agendamento.getServico();
        Prestador prestador = servico.getPrestador();
        return new AvaliacaoResponse(
                                    avaliacao.getId(), 
                                    agendamento.getId(), 
                                    cliente.getId(), 
                                    cliente.getNome(),
                                    prestador.getId(), 
                                    prestador.getNomeNegocio(),
                                    servico.getId(), 
                                    servico.getNome(), 
                                    agendamento.getDataHora(), 
                                    avaliacao.getNota(), 
                                    avaliacao.getComentario(), 
                                    avaliacao.getDataAvaliacao()
                                );
    }
}
