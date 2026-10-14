package com.example.agenda.controller;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.AvaliacaoRequest;
import com.example.agenda.dto.request.AvaliacaoUpdateRequest;
import com.example.agenda.dto.response.AvaliacaoResponse;
import com.example.agenda.dto.response.NotaMediaResponse;
import com.example.agenda.service.AvaliacaoService;

import jakarta.validation.Valid;

@RestController 
public class AvaliacaoController {
    private final AvaliacaoService avaliacaoService;

    public AvaliacaoController(AvaliacaoService avaliacaoService) {
        this.avaliacaoService = avaliacaoService;
    }

    @PostMapping("/avaliacoes")
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<AvaliacaoResponse> criar(@Valid @RequestBody AvaliacaoRequest request,
        @AuthenticationPrincipal JWTUserData userData) {
            AvaliacaoResponse response = avaliacaoService.criar(request, userData);
            return ResponseEntity.created(URI.create("/avaliacoes/" + response.id())).body(response);
        }
    
    @GetMapping("/avaliacoes")
    public ResponseEntity<List<AvaliacaoResponse>> listar(@AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(avaliacaoService.listar(userData));
    }

    @GetMapping("/avaliacoes/{id}")
    public ResponseEntity<AvaliacaoResponse> buscar(@PathVariable UUID id,
        @AuthenticationPrincipal JWTUserData userData
    ) {
        return ResponseEntity.ok(avaliacaoService.buscar(id, userData));
    }

    @PutMapping("/avaliacoes/{id}")
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<AvaliacaoResponse> atualizar(@PathVariable UUID id, 
        @Valid @RequestBody AvaliacaoUpdateRequest request, 
        @AuthenticationPrincipal JWTUserData userData
    ) {
        return ResponseEntity.ok(avaliacaoService.atualizar(id, request, userData));
    }

    @DeleteMapping("/avaliacoes/{id}")
    @PreAuthorize("hasAnyRole('CLIENTE', 'ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID id, 
        @AuthenticationPrincipal JWTUserData userData
    ) {
        avaliacaoService.excluir(id, userData);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/prestadores/{prestadorId}/avaliacoes")
    public ResponseEntity<List<AvaliacaoResponse>> listarPorPrestador(@PathVariable UUID prestadorId) {
        return ResponseEntity.ok(avaliacaoService.listarPorPrestador(prestadorId));
    }

    @GetMapping("/prestadores/{prestadorId}/avaliacoes/media")
    public ResponseEntity<NotaMediaResponse> notaMedia(@PathVariable UUID prestadorId) {
        return ResponseEntity.ok(avaliacaoService.notaMedia(prestadorId));
    }
}
