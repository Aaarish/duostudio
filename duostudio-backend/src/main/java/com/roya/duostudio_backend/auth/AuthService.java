package com.roya.duostudio_backend.auth;


import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserDao userDao;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authManager;
    private final UserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;


    public AuthService(UserDao userDao, JwtUtil jwtUtil, AuthenticationManager authManager, UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        this.userDao = userDao;
        this.jwtUtil = jwtUtil;
        this.authManager = authManager;
        this.userDetailsService = userDetailsService;
        this.passwordEncoder = passwordEncoder;
    }

    public AuthResponse register(RegisterRequest request) {
        User user = new User(request.email(), request.username(), passwordEncoder.encode(request.password()));
        User savedUser = userDao.save(user);

        AuthUser authUser = new AuthUser(savedUser);
        String token = jwtUtil.generateToken(authUser);
        return new AuthResponse(token, savedUser.getUsername());
    }

    public AuthResponse login(AuthRequest request) {
        authManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password())
        );

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.username());
        String token = jwtUtil.generateToken(userDetails);

        return new AuthResponse(token, userDetails.getUsername());
    }

}
