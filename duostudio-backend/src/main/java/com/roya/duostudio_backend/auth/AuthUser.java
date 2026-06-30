package com.roya.duostudio_backend.auth;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;


public class AuthUser implements UserDetails {
    private final String username;
    private final List<SimpleGrantedAuthority> authorities;

    public AuthUser(String username, List<SimpleGrantedAuthority> authorities) {
        this.username = username;
        this.authorities = authorities;
    }

    @Override
    public String getUsername() {
        return this.username;
    }

    @Override
    public String getPassword() {
        return null;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return this.authorities;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    // can be modified to add MFA: to add otp-based authentication on top of credentials-based auth.
    @Override
    public boolean isEnabled() {
        return true;
    }
}
