package com.roya.duostudio_backend.boards;

import tools.jackson.databind.JsonNode;

public record UpdateBoardRequest(
        JsonNode boardData,
        Long version) {
}
