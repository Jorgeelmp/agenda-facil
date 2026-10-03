package com.example.agenda.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.agenda.dto.response.ServicoResponse;
import com.example.agenda.repository.ServicoRepository;

@Service
@Transactional(readOnly = true)
public class PrestadorServicoService {

    private final PrestadorService prestadorService;
    private final ServicoRepository servicoRepository;

    public PrestadorServicoService(PrestadorService prestadorService, ServicoRepository servicoRepository) {
        this.prestadorService = prestadorService;
        this.servicoRepository = servicoRepository;
    }

    public List<ServicoResponse> listarAtivos(UUID prestadorId) {
        prestadorService.buscarEntidade(prestadorId);
        return servicoRepository.findByPrestadorIdAndAtivoTrueOrderByNomeAsc(prestadorId).stream()
                .map(ServicoResponse::fromEntity).toList();
    }
}
