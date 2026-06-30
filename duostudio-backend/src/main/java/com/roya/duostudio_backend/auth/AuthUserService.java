package com.roya.duostudio_backend.auth;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuthUserService {
    private final UserDao userDao;
    private final PasswordEncoder passwordEncoder;

    public AuthUserService(UserDao userDao, PasswordEncoder passwordEncoder) {
        this.userDao = userDao;
        this.passwordEncoder = passwordEncoder;
    }

    public AuthUserRecord registerUser(String email, String username, String password) {
        User user = new User(email, username, passwordEncoder.encode(password));
        User savedUser = userDao.save(user);

        return new AuthUserRecord(savedUser.getId(), savedUser.getUsername(), toAuthorities(savedUser));
    }

    public AuthUserRecord authenticate(String username, String rawPassword) {
        User user = userDao.findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new BadCredentialsException("Invalid username or password");
        }

        return new AuthUserRecord(user.getId(), user.getUsername(), toAuthorities(user));
    }

    public AuthUserRecord loadForRefresh(String username) {
        User user = userDao.findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException("User no longer exists"));

        List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()));
        return new AuthUserRecord(user.getId(), user.getUsername(), authorities);
    }

    private List<SimpleGrantedAuthority> toAuthorities(User user) {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()));
    }

}
