package com.example.agenda.controller;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.PrestadorRequest;
import com.example.agenda.dto.request.StatusPrestadorRequest;
import com.example.agenda.dto.response.DisponibilidadeResponse;
import com.example.agenda.dto.response.PrestadorResponse;
import com.example.agenda.service.DisponibilidadeService;
import com.example.agenda.service.PrestadorService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/prestadores")
public class PrestadorController {

    private final PrestadorService prestadorService;
    private final DisponibilidadeService disponibilidadeService;

    public PrestadorController(PrestadorService prestadorService, DisponibilidadeService disponibilidadeService) {
        this.prestadorService = prestadorService;
        this.disponibilidadeService = disponibilidadeService;
    }

    @PostMapping
    @PreAuthorize("hasRole('PRESTADOR')")
    public ResponseEntity<PrestadorResponse> criar(@Valid @RequestBody PrestadorRequest request,
            @AuthenticationPrincipal JWTUserData userData) {
        PrestadorResponse response = prestadorService.criar(request, userData);
        return ResponseEntity.created(URI.create("/prestadores/" + response.id())).body(response);
    }

    @GetMapping
    public ResponseEntity<List<PrestadorResponse>> listar(@RequestParam(required = false) Boolean ativo) {
        return ResponseEntity.ok(prestadorService.listar(ativo));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('PRESTADOR')")
    public ResponseEntity<PrestadorResponse> meuPerfil(@AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(prestadorService.buscarMeuPerfil(userData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PrestadorResponse> buscar(@PathVariable UUID id) {
        return ResponseEntity.ok(prestadorService.buscar(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ResponseEntity<PrestadorResponse> atualizar(@PathVariable UUID id,
            @Valid @RequestBody PrestadorRequest request,
            @AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(prestadorService.atualizar(id, request, userData));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ResponseEntity<PrestadorResponse> alterarStatus(@PathVariable UUID id,
            @Valid @RequestBody StatusPrestadorRequest request,
            @AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(prestadorService.alterarStatus(id, request.ativo(), userData));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID id, @AuthenticationPrincipal JWTUserData userData) {
        prestadorService.excluir(id, userData);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/disponibilidade")
    public ResponseEntity<DisponibilidadeResponse> disponibilidade(@PathVariable UUID id,
            @RequestParam UUID servicoId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate data) {
        return ResponseEntity.ok(disponibilidadeService.consultar(id, servicoId, data));
    }
}
