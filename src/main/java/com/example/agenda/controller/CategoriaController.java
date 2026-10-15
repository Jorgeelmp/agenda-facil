package com.example.agenda.controller;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.example.agenda.dto.request.CategoriaRequest;
import com.example.agenda.dto.response.CategoriaResponse;
import com.example.agenda.service.CategoriaService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/categorias")
public class CategoriaController {
    private final CategoriaService categorias;

    public CategoriaController(CategoriaService categorias) { this.categorias = categorias; }

    @GetMapping
    public List<CategoriaResponse> listar() { return categorias.listar(); }

    @GetMapping("/{id}")
    public CategoriaResponse buscar(@PathVariable UUID id) { return categorias.buscar(id); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CategoriaResponse> criar(@Valid @RequestBody CategoriaRequest request) {
        CategoriaResponse response = categorias.criar(request);
        return ResponseEntity.created(URI.create("/categorias/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CategoriaResponse atualizar(@PathVariable UUID id, @Valid @RequestBody CategoriaRequest request) {
        return categorias.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        categorias.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
