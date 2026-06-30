package com.roya.duostudio_backend.auth;

import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.UUID;

public record AuthUserRecord(UUID userId, String username, List<SimpleGrantedAuthority> authorities) {
}
