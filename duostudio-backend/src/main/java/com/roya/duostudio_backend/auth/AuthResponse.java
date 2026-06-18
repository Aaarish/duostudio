package com.roya.duostudio_backend.auth;

public record AuthResponse (
        String token,
        String userId) {
}
