package com.example.agenda.service;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.HorarioFuncionamentoRequest;
import com.example.agenda.dto.response.HorarioFuncionamentoResponse;
import com.example.agenda.entity.HorarioFuncionamento;
import com.example.agenda.entity.Prestador;
import com.example.agenda.repository.HorarioFuncionamentoRepository;

@Service
@Transactional(readOnly = true)
public class HorarioFuncionamentoService {

    private final HorarioFuncionamentoRepository horarioRepository;
    private final PrestadorService prestadorService;

    public HorarioFuncionamentoService(HorarioFuncionamentoRepository horarioRepository,
            PrestadorService prestadorService) {
        this.horarioRepository = horarioRepository;
        this.prestadorService = prestadorService;
    }

    @Transactional
    public HorarioFuncionamentoResponse criar(UUID prestadorId, HorarioFuncionamentoRequest request,
            JWTUserData userData) {
        Prestador prestador = prestadorService.buscarParaGerenciar(prestadorId, userData);
        if (horarioRepository.existsByPrestadorIdAndDiaSemana(prestadorId, request.diaSemana())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe horário de funcionamento para este dia");
        }
        HorarioFuncionamento horario = new HorarioFuncionamento();
        horario.setPrestador(prestador);
        preencher(horario, request);
        return HorarioFuncionamentoResponse.fromEntity(horarioRepository.saveAndFlush(horario));
    }

    public List<HorarioFuncionamentoResponse> listar(UUID prestadorId) {
        prestadorService.buscarEntidade(prestadorId);
        return horarioRepository.findByPrestadorId(prestadorId).stream()
                .sorted(Comparator.comparing(HorarioFuncionamento::getDiaSemana))
                .map(HorarioFuncionamentoResponse::fromEntity).toList();
    }

    public HorarioFuncionamentoResponse buscar(UUID prestadorId, UUID horarioId) {
        prestadorService.buscarEntidade(prestadorId);
        return HorarioFuncionamentoResponse.fromEntity(buscarEntidade(prestadorId, horarioId));
    }

    @Transactional
    public HorarioFuncionamentoResponse atualizar(UUID prestadorId, UUID horarioId,
            HorarioFuncionamentoRequest request, JWTUserData userData) {
        prestadorService.buscarParaGerenciar(prestadorId, userData);
        HorarioFuncionamento horario = buscarEntidade(prestadorId, horarioId);
        if (horarioRepository.existsByPrestadorIdAndDiaSemanaAndIdNot(prestadorId, request.diaSemana(), horarioId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe horário de funcionamento para este dia");
        }
        preencher(horario, request);
        return HorarioFuncionamentoResponse.fromEntity(horarioRepository.saveAndFlush(horario));
    }

    @Transactional
    public void excluir(UUID prestadorId, UUID horarioId, JWTUserData userData) {
        prestadorService.buscarParaGerenciar(prestadorId, userData);
        horarioRepository.delete(buscarEntidade(prestadorId, horarioId));
    }

    private HorarioFuncionamento buscarEntidade(UUID prestadorId, UUID horarioId) {
        return horarioRepository.findByIdAndPrestadorId(horarioId, prestadorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Horário de funcionamento não encontrado"));
    }

    private void preencher(HorarioFuncionamento horario, HorarioFuncionamentoRequest request) {
        horario.setDiaSemana(request.diaSemana());
        horario.setHoraInicio(request.horaInicio());
        horario.setHoraFim(request.horaFim());
        horario.setIntervaloInicio(request.intervaloInicio());
        horario.setIntervaloFim(request.intervaloFim());
    }
}
