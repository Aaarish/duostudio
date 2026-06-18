package com.roya.duostudio_backend.auth;

import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AuthUserService implements UserDetailsService {
    private final UserDao userDao;

    public AuthUserService(UserDao userDao) {
        this.userDao = userDao;
    }

    @Override
    public AuthUser loadUserByUsername(String username) throws UsernameNotFoundException {
        return userDao.findByUsername(username)
                .map(AuthUser::new)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with username: " + username));
    }

}
