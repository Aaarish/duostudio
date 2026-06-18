package com.roya.duostudio_backend.boards;

import tools.jackson.databind.JsonNode;

public record CreateBoardRequest(
        BoardType type,
        JsonNode boardData,
        Long version) {
}
