package com.roya.duostudio_backend.auth;

public record AuthRequest (
        String username,
        String password) {
}
