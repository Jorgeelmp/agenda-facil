package com.example.agenda.service;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.ServicoRequest;
import com.example.agenda.dto.response.ServicoDetalheResponse;
import com.example.agenda.entity.Categoria;
import com.example.agenda.entity.Servico;
import com.example.agenda.repository.CategoriaRepository;
import com.example.agenda.repository.ServicoRepository;

@Service
@Transactional(readOnly = true)
public class ServicoService {
    private final ServicoRepository servicos;
    private final CategoriaRepository categorias;
    private final PrestadorService prestadores;

    public ServicoService(ServicoRepository servicos, CategoriaRepository categorias, PrestadorService prestadores) {
        this.servicos = servicos;
        this.categorias = categorias;
        this.prestadores = prestadores;
    }

    public List<ServicoDetalheResponse> catalogo(UUID categoriaId, BigDecimal precoMin, BigDecimal precoMax, String nome) {
        Specification<Servico> spec = filtros(categoriaId, precoMin, precoMax, nome)
                .and((root, query, cb) -> cb.and(cb.isTrue(root.get("ativo")), cb.isTrue(root.get("prestador").get("ativo"))));
        return consultar(spec);
    }

    public List<ServicoDetalheResponse> gerenciar(UUID prestadorId, JWTUserData userData) {
        prestadores.buscarParaGerenciar(prestadorId, userData);
        return consultar((root, query, cb) -> cb.equal(root.get("prestador").get("id"), prestadorId));
    }

    public ServicoDetalheResponse buscar(UUID prestadorId, UUID id, JWTUserData userData) {
        Servico servico = entidade(prestadorId, id);
        if (!Boolean.TRUE.equals(servico.getAtivo()) || !Boolean.TRUE.equals(servico.getPrestador().getAtivo())) {
            prestadores.buscarParaGerenciar(prestadorId, userData);
        }
        return ServicoDetalheResponse.fromEntity(servico);
    }

    @Transactional
    public ServicoDetalheResponse criar(UUID prestadorId, ServicoRequest request, JWTUserData userData) {
        Servico servico = new Servico();
        servico.setPrestador(prestadores.buscarParaGerenciar(prestadorId, userData));
        preencher(servico, request);
        return ServicoDetalheResponse.fromEntity(servicos.saveAndFlush(servico));
    }

    @Transactional
    public ServicoDetalheResponse atualizar(UUID prestadorId, UUID id, ServicoRequest request, JWTUserData userData) {
        prestadores.buscarParaGerenciar(prestadorId, userData);
        Servico servico = entidade(prestadorId, id);
        if (!servico.getDuracaoMinutos().equals(request.duracaoMinutos()) && servicos.possuiAgendamentos(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Serviço possui agendamentos. Mantenha a duração e crie outro serviço para uma nova duração");
        }
        preencher(servico, request);
        return ServicoDetalheResponse.fromEntity(servicos.saveAndFlush(servico));
    }

    @Transactional
    public void excluir(UUID prestadorId, UUID id, JWTUserData userData) {
        prestadores.buscarParaGerenciar(prestadorId, userData);
        Servico servico = entidade(prestadorId, id);
        if (servicos.possuiAgendamentos(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Serviço possui agendamentos. Inative-o para preservar o histórico");
        }
        servicos.delete(servico);
        servicos.flush();
    }

    private void preencher(Servico servico, ServicoRequest request) {
        List<Categoria> selecionadas = categorias.findAllById(request.categoriaIds());
        if (selecionadas.size() != request.categoriaIds().size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Uma ou mais categorias não foram encontradas");
        }
        servico.setNome(request.nome());
        servico.setDescricao(request.descricao());
        servico.setDuracaoMinutos(request.duracaoMinutos());
        servico.setPreco(request.preco());
        servico.setAtivo(request.ativo());
        servico.setCategorias(new HashSet<>(selecionadas));
    }

    private Servico entidade(UUID prestadorId, UUID id) {
        return servicos.findById(id).filter(s -> s.getPrestador().getId().equals(prestadorId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Serviço não encontrado neste prestador"));
    }

    private List<ServicoDetalheResponse> consultar(Specification<Servico> spec) {
        return servicos.findAll(spec, Sort.by("nome").ascending().and(Sort.by("id")))
                .stream().map(ServicoDetalheResponse::fromEntity).toList();
    }

    private Specification<Servico> filtros(UUID categoriaId, BigDecimal precoMin, BigDecimal precoMax, String nome) {
        validarPreco(precoMin);
        validarPreco(precoMax);
        if (precoMin != null && precoMax != null && precoMin.compareTo(precoMax) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preço mínimo não pode superar o preço máximo");
        }
        if (nome != null && nome.length() > 150) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Busca deve ter até 150 caracteres");
        }
        if (categoriaId != null && !categorias.existsById(categoriaId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoria não encontrada");
        }
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (categoriaId != null) {
                predicates.add(cb.equal(root.join("categorias").get("id"), categoriaId));
            }
            if (precoMin != null) predicates.add(cb.greaterThanOrEqualTo(root.get("preco"), precoMin));
            if (precoMax != null) predicates.add(cb.lessThanOrEqualTo(root.get("preco"), precoMax));
            if (nome != null && !nome.isBlank()) {
                String termo = nome.strip().toLowerCase(java.util.Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                predicates.add(cb.like(cb.lower(root.get("nome")), "%" + termo + "%", '\\'));
            }
            query.distinct(true);
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private void validarPreco(BigDecimal preco) {
        if (preco != null && (preco.signum() < 0 || preco.compareTo(new BigDecimal("99999999.99")) > 0
                || preco.stripTrailingZeros().scale() > 2)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Filtro de preço deve estar entre 0 e 99999999.99, com até 2 casas decimais");
        }
    }
}
