package com.example.agenda.validation;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;

import com.example.agenda.entity.enums.DiaSemana;
import com.example.agenda.entity.enums.StatusAgendamento;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

public final class RequestDeserializers {

    private RequestDeserializers() {
    }

    public static class StrictString extends ValueDeserializer<String> {
        @Override
        public String deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() != JsonToken.VALUE_STRING) {
                return context.reportInputMismatch(String.class, "Campo deve ser um texto JSON");
            }
            return parser.getString();
        }
    }

    public static class StrictBoolean extends ValueDeserializer<Boolean> {
        @Override
        public Boolean deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() == JsonToken.VALUE_TRUE) {
                return true;
            }
            if (parser.currentToken() == JsonToken.VALUE_FALSE) {
                return false;
            }
            return context.reportInputMismatch(Boolean.class, "Campo deve ser true ou false, sem aspas");
        }
    }

    public static class StrictDiaSemana extends ValueDeserializer<DiaSemana> {
        @Override
        public DiaSemana deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() != JsonToken.VALUE_STRING) {
                return context.reportInputMismatch(DiaSemana.class, "Dia da semana deve ser um texto JSON");
            }
            try {
                return DiaSemana.valueOf(parser.getString());
            } catch (IllegalArgumentException ex) {
                return context.reportInputMismatch(DiaSemana.class, "Dia da semana deve ser SEG, TER, QUA, QUI, SEX, SAB ou DOM");
            }
        }
    }

    public static class StrictLocalTime extends ValueDeserializer<LocalTime> {
        @Override
        public LocalTime deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() != JsonToken.VALUE_STRING) {
                return context.reportInputMismatch(LocalTime.class, "Horário deve ser um texto JSON no formato HH:mm[:ss]");
            }
            try {
                return LocalTime.parse(parser.getString());
            } catch (DateTimeParseException ex) {
                return context.reportInputMismatch(LocalTime.class, "Horário inválido. Use HH:mm[:ss[.SSS]]");
            }
        }
    }

    public static class StrictLocalDateTime extends ValueDeserializer<LocalDateTime> {
        @Override
        public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() != JsonToken.VALUE_STRING) {
                return context.reportInputMismatch(LocalDateTime.class, "Data e hora devem ser um texto JSON no formato yyyy-MM-ddTHH:mm[:ss]");
            }
            try {
                return LocalDateTime.parse(parser.getString());
            } catch (DateTimeParseException ex) {
                return context.reportInputMismatch(LocalDateTime.class, "Data e hora inválidas. Use yyyy-MM-ddTHH:mm[:ss]");
            }
        }
    }

    public static class StrictStatusAgendamento extends ValueDeserializer<StatusAgendamento> {
        @Override
        public StatusAgendamento deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() != JsonToken.VALUE_STRING) {
                return context.reportInputMismatch(StatusAgendamento.class, "Status deve ser um texto JSON");
            }
            try {
                return StatusAgendamento.valueOf(parser.getString());
            } catch (IllegalArgumentException ex) {
                return context.reportInputMismatch(StatusAgendamento.class,
                        "Status deve ser PENDENTE, CONFIRMADO, CANCELADO ou CONCLUIDO");
            }
        }
    }
}
