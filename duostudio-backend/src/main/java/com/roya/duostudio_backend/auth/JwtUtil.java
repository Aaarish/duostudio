package com.roya.duostudio_backend.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
public class JwtUtil {
    private String SECRET_KEY;

    public JwtUtil(@Value("${jwt.secret.key}") String SECRET_KEY) {
        this.SECRET_KEY = SECRET_KEY;
    }

    private static final String ISSUER = "THE_CLUB_APPLICATION";
    private static final String TYPE_ACCESS_TOKEN = "ACCESS_TOKEN";
    private static final long ACCESS_TOKEN_EXPIRATION_TIME_IN_MILLIS = 1000 * 60 * 60 * 24 * 7L; // 7 days
    private static final String TYPE_REFRESH_TOKEN = "REFRESH_TOKEN";
    private static final long REFRESH_TOKEN_EXPIRATION_TIME_IN_MILLIS = 1000 * 60 * 15L; // 15 minutes

    public SecretKey getSecretKey() {
        return Keys.hmacShaKeyFor(SECRET_KEY.getBytes());
    }

    public String generateAccessToken(String username, List<SimpleGrantedAuthority> authorities) {
        return Jwts.builder()
                .setIssuer(ISSUER)
                .setSubject(username)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + ACCESS_TOKEN_EXPIRATION_TIME_IN_MILLIS))
                .claim("type", TYPE_ACCESS_TOKEN)
                .claim("roles", authorities.stream()
                    .map(GrantedAuthority::getAuthority)
                    .toList())
                .signWith(getSecretKey())
                .compact();
    }

    public String generateRefreshToken(String username, String jti) {
        return Jwts.builder()
                .setIssuer(ISSUER)
                .setSubject(username)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + REFRESH_TOKEN_EXPIRATION_TIME_IN_MILLIS))
                .claim("type", TYPE_REFRESH_TOKEN)
                .claim("jti", jti)
                .signWith(getSecretKey())
                .compact();
    }

    public String generateJti() {
        return UUID.randomUUID().toString();
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSecretKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean isAccessToken(String token) {
        Claims claims = parseClaims(token);
        String type = claims.get("type", String.class);
        return TYPE_ACCESS_TOKEN.equals(type);
    }

    public boolean isRefreshToken(String token) {
        Claims claims = parseClaims(token);
        String type = claims.get("type", String.class);
        return TYPE_REFRESH_TOKEN.equals(type);
    }

    public String extractUsername(String token) {
        Claims claims = parseClaims(token);
        return claims.getSubject();
    }

    public String extractJti(String token) {
        Claims claims = parseClaims(token);
        return claims.get("jti", String.class);
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