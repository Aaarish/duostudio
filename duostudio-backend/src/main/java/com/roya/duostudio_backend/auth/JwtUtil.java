package com.roya.duostudio_backend.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;

@Service
public class JwtUtil {
    private static final String SECRET_KEY = "secretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecret";
    private static final long EXPIRATION_TIME_IN_MILLIS = 1000 * 60 * 60 * 10L; // 10 hours
    private static final String ISSUER = "THE_CLUB_APPLICATION";

    public SecretKey getSecretKey() {
        return Keys.hmacShaKeyFor(SECRET_KEY.getBytes());
    }

    public String generateToken(UserDetails userDetails) {
        return Jwts.builder()
                .setIssuer(ISSUER)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME_IN_MILLIS))
                .claim("roles", userDetails.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .toList())
                .signWith(getSecretKey())
                .compact();
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSecretKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String extractUsername(String token) {
        Claims claims = parseClaims(token);
        return claims.getSubject();
    }

    public Date extractExpiration(String token) {
        Claims claims = parseClaims(token);
        return claims.getExpiration();
    }

    public List<SimpleGrantedAuthority> extractRoles(String token) {
        Claims claims = parseClaims(token);
        List<String> roles = claims.get("roles", List.class);

        return roles.stream()
                .map(SimpleGrantedAuthority::new)
                .toList();
    }

    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public Boolean validateToken(String token) {
        try {
            return !isTokenExpired(token);
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}