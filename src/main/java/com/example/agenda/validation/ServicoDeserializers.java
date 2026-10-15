package com.example.agenda.validation;

import java.math.BigDecimal;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

public final class ServicoDeserializers {
    private ServicoDeserializers() { }

    public static class Inteiro extends ValueDeserializer<Integer> {
        @Override
        public Integer deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
                return context.reportInputMismatch(Integer.class, "Duração deve ser um número inteiro JSON");
            }
            return parser.getIntValue();
        }
    }

    public static class Decimal extends ValueDeserializer<BigDecimal> {
        @Override
        public BigDecimal deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT && parser.currentToken() != JsonToken.VALUE_NUMBER_FLOAT) {
                return context.reportInputMismatch(BigDecimal.class, "Preço deve ser um número JSON");
            }
            return parser.getDecimalValue();
        }
    }
}
