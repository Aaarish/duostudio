package com.roya.duostudio_backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest (
        String email,
        @NotBlank(message = "username cannot be empty") @Size(min = 3, message = "username must be at least 3 characters long") String username,
        @NotBlank(message = "password cannot be empty") @Size(min = 6, message = "password must be at least 6 characters long") String password) {
}
