package com.company.inventory.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.company.inventory.entity.Role;
import com.company.inventory.entity.User;
import com.company.inventory.repository.UserRepository;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        return org.springframework.security.core.userdetails.User
                .withUsername(user.getEmail())
                .password(user.getPassword())
                .authorities(authoritiesFor(user.getRole()))
                // A deactivated account is rejected by the DaoAuthenticationProvider,
                // so suspending someone takes effect on their next sign-in attempt.
                .disabled(!user.isEnabled())
                .build();
    }

    /**
     * The master admin also carries ROLE_ADMIN.
     *
     * <p>Every existing rule in SecurityConfig and every {@code @PreAuthorize("hasRole('ADMIN')")}
     * therefore keeps working for the owner account, and MASTER_ADMIN is layered on top purely
     * as the extra privilege needed for account management — rather than the master admin
     * silently losing access to the rest of the application.</p>
     */
    private static List<GrantedAuthority> authoritiesFor(Role role) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + role.name()));
        if (role == Role.MASTER_ADMIN) {
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        }
        return authorities;
    }
}
