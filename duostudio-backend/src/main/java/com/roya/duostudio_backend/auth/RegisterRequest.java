package com.roya.duostudio_backend.auth;

public record RegisterRequest (
        String email,
        String username,
        String password) {
}
