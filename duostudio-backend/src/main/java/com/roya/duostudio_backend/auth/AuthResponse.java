package com.roya.duostudio_backend.auth;

import java.util.UUID;

public record AuthResponse (
        String accessToken,
        UUID userId) {
}
