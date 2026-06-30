package com.roya.duostudio_backend.auth.tokens;

public record AccessAndRefreshToken(
        String accessToken,
        String refreshToken) {
}
