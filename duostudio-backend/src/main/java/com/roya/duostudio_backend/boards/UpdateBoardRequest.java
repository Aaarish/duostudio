package com.roya.duostudio_backend.boards;

import java.util.Map;

public record UpdateBoardRequest(
        Map<String, Object> boardData,
        Long version) {
}
