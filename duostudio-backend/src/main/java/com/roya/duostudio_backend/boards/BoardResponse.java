package com.roya.duostudio_backend.boards;

import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.UUID;

public record BoardResponse(
        UUID id,
        UUID userId,
        BoardType type,
        JsonNode boardData,
        Long version,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
