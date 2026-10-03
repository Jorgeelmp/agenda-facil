package com.example.agenda.validation;

import java.time.LocalTime;
import java.time.format.DateTimeParseException;

import com.example.agenda.entity.enums.DiaSemana;

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
}
