package com.roya.duostudio_backend.boards;

import com.roya.duostudio_backend.auth.AuthUser;
import com.roya.duostudio_backend.auth.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/boards")
public class BoardController {
    private final BoardService boardService;

    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }


    @PostMapping
    public ResponseEntity<BoardResponse> createBoard(@RequestBody CreateBoardRequest request, @AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(boardService.createBoard(request, user.getUsername()));
    }

    @GetMapping("/{boardId}")
    public ResponseEntity<BoardResponse> getBoard(@PathVariable UUID boardId) {
        return ResponseEntity.ok(boardService.getBoard(boardId));
    }

    @PutMapping("/{boardId}")
    public ResponseEntity<BoardResponse> updateBoard(@PathVariable UUID boardId, @RequestBody UpdateBoardRequest request) {
        return ResponseEntity.ok(boardService.updateBoard(boardId, request));
    }

    @DeleteMapping("/{boardId}")
    public ResponseEntity<String> deleteBoard(@PathVariable UUID boardId) {
        boardService.deleteBoard(boardId);
        return ResponseEntity.ok("Board: " + boardId + " deleted successfully");
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<List<BoardResponse>> getAllBoardsOfUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(boardService.getAllBoardsOfUser(userId));
    }

}
