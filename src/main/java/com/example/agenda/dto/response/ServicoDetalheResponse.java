package com.example.agenda.dto.response;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import com.example.agenda.entity.Servico;

public record ServicoDetalheResponse(UUID id, UUID prestadorId, String nomeNegocio, String nome,
        String descricao, Integer duracaoMinutos, BigDecimal preco, Boolean ativo, List<CategoriaResponse> categorias) {
    public static ServicoDetalheResponse fromEntity(Servico servico) {
        return new ServicoDetalheResponse(servico.getId(), servico.getPrestador().getId(),
                servico.getPrestador().getNomeNegocio(), servico.getNome(), servico.getDescricao(),
                servico.getDuracaoMinutos(), servico.getPreco(), servico.getAtivo(),
                servico.getCategorias().stream().map(CategoriaResponse::fromEntity)
                        .sorted(Comparator.comparing(CategoriaResponse::nome, String.CASE_INSENSITIVE_ORDER)).toList());
    }
}
