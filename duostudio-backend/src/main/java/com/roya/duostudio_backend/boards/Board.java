package com.roya.duostudio_backend.boards;

import com.roya.duostudio_backend.auth.User;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "boards")
public class Board {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    private User user;

    @Enumerated(EnumType.STRING)
    private BoardType type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "board_data", columnDefinition = "jsonb", nullable = false)
    private JsonNode boardData;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public Board() {
    }

    public Board(User user, BoardType type, JsonNode boardData, Long version) {
        this.id = UUID.randomUUID();
        this.user = user;
        this.type = type;
        this.boardData = boardData;
        this.version = version;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public BoardType getType() {
        return type;
    }

    public void setType(BoardType type) {
        this.type = type;
    }

    public JsonNode getBoardData() {
        return boardData;
    }

    public void setBoardData(JsonNode boardData) {
        this.boardData = boardData;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
