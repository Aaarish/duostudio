package com.roya.duostudio_backend.auth.tokens;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name="refresh_tokens")
public class RefreshToken {
    @Id
    private String jti;
    @Column(nullable = false)
    private String username;
    @Column(nullable = false)
    private LocalDateTime expiry;
    @Column(nullable = false)
    private boolean revoked;

    public RefreshToken() {
    }

    public RefreshToken(String jti, String username, LocalDateTime expiry) {
        this.jti = jti;
        this.username = username;
        this.expiry = expiry;
        this.revoked = false;
    }

    public String getJti() {
        return jti;
    }

    public void setJti(String jti) {
        this.jti = jti;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public LocalDateTime getExpiry() {
        return expiry;
    }

    public void setExpiry(LocalDateTime expiry) {
        this.expiry = expiry;
    }

    public boolean isExpired() {
        return this.expiry.isBefore(LocalDateTime.now());
    }

    public boolean isRevoked() {
        return revoked;
    }

    public void setRevoked(boolean revoked) {
        this.revoked = revoked;
    }

}
