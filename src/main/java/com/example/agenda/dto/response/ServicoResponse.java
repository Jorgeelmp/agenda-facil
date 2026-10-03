package com.example.agenda.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

import com.example.agenda.entity.Servico;

public record ServicoResponse(UUID id, String nome, String descricao, Integer duracaoMinutos,
                              BigDecimal preco, Boolean ativo) {

    public static ServicoResponse fromEntity(Servico servico) {
        return new ServicoResponse(servico.getId(), servico.getNome(), servico.getDescricao(),
                servico.getDuracaoMinutos(), servico.getPreco(), servico.getAtivo());
    }
}
