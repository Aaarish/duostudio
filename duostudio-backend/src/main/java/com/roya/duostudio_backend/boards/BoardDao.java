package com.roya.duostudio_backend.boards;

import com.roya.duostudio_backend.auth.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BoardDao extends JpaRepository<Board, UUID> {
    List<Board> findByUser(User user);

    List<Board> findByUserId(UUID userId);

}
