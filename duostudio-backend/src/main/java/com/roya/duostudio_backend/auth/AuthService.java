package com.roya.duostudio_backend.auth;

import com.roya.duostudio_backend.auth.tokens.AccessAndRefreshToken;
import com.roya.duostudio_backend.auth.tokens.RefreshToken;
import com.roya.duostudio_backend.auth.tokens.RefreshTokenDao;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AuthService {
    private final JwtUtil jwtUtil;
    private final RefreshTokenDao refreshTokenDao;
    private final AuthUserService authUserService;

    private static final String REFRESH_COOKIE_NAME = "refresh_token";
    private static final int REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;


    public AuthService(JwtUtil jwtUtil, AuthUserService authUserService, RefreshTokenDao refreshTokenDao) {
        this.jwtUtil = jwtUtil;
        this.authUserService = authUserService;
        this.refreshTokenDao = refreshTokenDao;
    }

    public AuthResponse register(RegisterRequest request, HttpServletResponse response) {
        AuthUserRecord userRecord = authUserService.registerUser(request.email(), request.username(), request.password());
        AccessAndRefreshToken accessAndRefreshTokens = createAccessAndRefreshTokens(userRecord);

        setRefreshCookie(response, accessAndRefreshTokens.refreshToken());

        return new AuthResponse(accessAndRefreshTokens.accessToken(), userRecord.userId());
    }

    public AuthResponse login(AuthRequest request, HttpServletResponse response) {
        AuthUserRecord userRecord = authUserService.authenticate(request.username(), request.password());
        AccessAndRefreshToken accessAndRefreshTokens = createAccessAndRefreshTokens(userRecord);

        setRefreshCookie(response, accessAndRefreshTokens.refreshToken());

        return new AuthResponse(accessAndRefreshTokens.accessToken(), userRecord.userId());
    }

    public ResponseEntity<AuthResponse> refreshToken(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = extractRefreshCookie(request);
        if (refreshToken == null || !jwtUtil.validateToken(refreshToken) || !jwtUtil.isRefreshToken(refreshToken)) {
            return ResponseEntity.status(401).build();
        }

        String jti = jwtUtil.extractJti(refreshToken);
        String username = jwtUtil.extractUsername(refreshToken);

        RefreshToken stored = refreshTokenDao.findByJti(jti).orElse(null);

        if (stored == null) {
            // Token was signed validly but we have no record of it — either it
            // was never issued by us in a recognizable way, or it was already
            // cleaned up after expiry. Treat as invalid.
            return ResponseEntity.status(401).build();
        }

        if (stored.isRevoked()) {
            // This is the reuse-detection trigger described above: a refresh
            // accessToken that was already rotated out is being used again. That
            // should only happen if it was stolen and the thief and the real
            // user both tried to use it. Nuke every session for this user as
            // a precaution, forcing a fresh login everywhere.
            refreshTokenDao.revokeAllForUser(username);
            clearRefreshCookie(response);
            return ResponseEntity.status(401).build();
        }

        if (stored.isExpired()) {
            return ResponseEntity.status(401).build();
        }

        // --- Rotation: revoke the one being used, issue a brand new one ---
        stored.setRevoked(true);
        refreshTokenDao.save(stored);

        // Re-derive authorities fresh from the DB here (not from the old refresh
        // accessToken) — this is exactly the moment role/status changes get picked up,
        // since this is the one checkpoint we kept stateful.
        AuthUserRecord userRecord = authUserService.loadForRefresh(username);
        List<SimpleGrantedAuthority> authorities = userRecord.authorities();

        AccessAndRefreshToken accessAndRefreshTokens = createAccessAndRefreshTokens(userRecord);
        setRefreshCookie(response, accessAndRefreshTokens.refreshToken());

        return ResponseEntity.ok(new AuthResponse(accessAndRefreshTokens.accessToken(), userRecord.userId()));
    }

    public void logout(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = extractRefreshCookie(request);

        if (refreshToken != null && jwtUtil.validateToken(refreshToken) && jwtUtil.isRefreshToken(refreshToken)) {
            String jti = jwtUtil.extractJti(refreshToken);
            refreshTokenDao.findByJti(jti).ifPresent(stored -> {
                stored.setRevoked(true);
                refreshTokenDao.save(stored);
            });
        }

        clearRefreshCookie(response);
    }

    private AccessAndRefreshToken createAccessAndRefreshTokens(AuthUserRecord userRecord) {
        String accessToken = jwtUtil.generateAccessToken(userRecord.username(), userRecord.authorities());

        String jti = jwtUtil.generateJti();
        String refreshToken = jwtUtil.generateRefreshToken(userRecord.username(), jti);
        RefreshToken refreshTokenRecord = new RefreshToken(
                jti, userRecord.username(), LocalDateTime.now().plusSeconds(REFRESH_COOKIE_MAX_AGE_SECONDS)
        );

        refreshTokenDao.save(refreshTokenRecord);
        return new AccessAndRefreshToken(accessToken, refreshToken);
    }

    private void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        Cookie cookie = new Cookie(REFRESH_COOKIE_NAME, refreshToken);
        cookie.setHttpOnly(true);   // JS cannot read this - mitigates XSS accessToken theft
        cookie.setSecure(true);     // HTTPS only - mitigates network interception
        cookie.setPath("/auth");    // only sent to auth endpoints, not every request
        cookie.setMaxAge(REFRESH_COOKIE_MAX_AGE_SECONDS);
        // If client and API are on different subdomains, also set:
        // cookie.setAttribute("SameSite", "Strict"); (via response header if using Servlet < 6,
        // or cookie.setAttribute directly on Servlet 6+ / Spring's ResponseCookie builder)
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_COOKIE_NAME, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/auth");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (REFRESH_COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

}
