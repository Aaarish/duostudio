package com.roya.duostudio_backend.boards;

import java.util.Map;

public record CreateBoardRequest(
        BoardType type,
        Map<String, Object> boardData) {
}
