package com.roya.duostudio_backend.boards;

import com.roya.duostudio_backend.auth.User;
import com.roya.duostudio_backend.auth.UserDao;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class BoardService {
    private final BoardDao boardDao;
    private final UserDao userDao;

    public BoardService(BoardDao boardDao, UserDao userDao) {
        this.boardDao = boardDao;
        this.userDao = userDao;
    }

    public BoardResponse createBoard(CreateBoardRequest request, String username) {
        User user = userDao.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found with username: " + username));
        Board board = new Board(user, request.type(), request.boardData());

        boardDao.save(board);
        return map(board);
    }

    public BoardResponse getBoard(UUID boardId) {
        Board board = boardDao.findById(boardId)
                .orElseThrow(() -> new RuntimeException("Board not found with id: " + boardId));

        return map(board);
    }

    public BoardResponse updateBoard(UUID boardId, UpdateBoardRequest request) {
        Board board = boardDao.findById(boardId)
                .orElseThrow(() -> new RuntimeException("Board not found with id: " + boardId));

//        if (!board.getVersion().equals(request.version())) {
//            throw new OptimisticLockException(
//                    "Whiteboard was modified by another session"
//            );
//        }

        board.setBoardData(request.boardData());
        board.setUpdatedAt(LocalDateTime.now());
//        board.setVersion(request.version());

        Board savedBoard = boardDao.save(board);

        return map(savedBoard);
    }

    public void deleteBoard(UUID boardId) {
        Board board = boardDao.findById(boardId)
                .orElseThrow(() -> new RuntimeException("Board not found with id: " + boardId));

        boardDao.delete(board);
    }

    public List<BoardResponse> getAllBoardsOfUser(UUID userId) {
        return boardDao.findByUserId(userId).stream()
                .map(this::map)
                .toList();
    }

    private BoardResponse map(Board board) {
        return new BoardResponse(
                board.getId(),
                board.getUser().getId(),
                board.getType(),
                board.getBoardData(),
                board.getVersion(),
                board.getCreatedAt(),
                board.getUpdatedAt());
    }

}
