package com.example.agenda.service;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.example.agenda.dto.request.CategoriaRequest;
import com.example.agenda.dto.response.CategoriaResponse;
import com.example.agenda.entity.Categoria;
import com.example.agenda.repository.CategoriaRepository;
import com.example.agenda.repository.ServicoRepository;

@Service
@Transactional(readOnly = true)
public class CategoriaService {
    private final CategoriaRepository categorias;
    private final ServicoRepository servicos;

    public CategoriaService(CategoriaRepository categorias, ServicoRepository servicos) {
        this.categorias = categorias;
        this.servicos = servicos;
    }

    public List<CategoriaResponse> listar() {
        return categorias.findAllByOrderByNomeAsc().stream().map(CategoriaResponse::fromEntity).toList();
    }

    public CategoriaResponse buscar(UUID id) {
        return CategoriaResponse.fromEntity(entidade(id));
    }

    @Transactional
    public CategoriaResponse criar(CategoriaRequest request) {
        return salvar(new Categoria(), request);
    }

    @Transactional
    public CategoriaResponse atualizar(UUID id, CategoriaRequest request) {
        return salvar(entidade(id), request);
    }

    @Transactional
    public void excluir(UUID id) {
        Categoria categoria = entidade(id);
        if (servicos.existsByCategoriasId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Categoria vinculada a serviços. Remova os vínculos antes de excluí-la");
        }
        categorias.delete(categoria);
        categorias.flush();
    }

    private CategoriaResponse salvar(Categoria categoria, CategoriaRequest request) {
        if (categorias.buscarMesmoNome(request.nome()).stream().anyMatch(c -> !c.getId().equals(categoria.getId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe uma categoria com este nome");
        }
        categoria.setNome(request.nome());
        categoria.setDescricao(request.descricao());
        return CategoriaResponse.fromEntity(categorias.saveAndFlush(categoria));
    }

    private Categoria entidade(UUID id) {
        return categorias.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoria não encontrada"));
    }
}
