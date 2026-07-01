package com.roya.duostudio_backend.auth.tokens;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenDao extends JpaRepository<RefreshToken, String> {
    Optional<RefreshToken> findByJti(String jti);

    @Override
    List<RefreshToken> findAll();

    List<RefreshToken> findAllByUsernameAndRevokedFalse(String username);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.username = :username AND r.revoked = false")
    void revokeAllForUser(@Param("username") String username);

}
