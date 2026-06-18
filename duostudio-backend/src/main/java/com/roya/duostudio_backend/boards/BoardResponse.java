package com.roya.duostudio_backend.boards;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record BoardResponse(
        UUID id,
        UUID userId,
        BoardType type,
        Map<String, Object> boardData,
        Long version,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
