package com.logwatch.service;

import com.logwatch.dto.AuthResponse;
import com.logwatch.dto.LoginRequest;
import com.logwatch.dto.RegisterRequest;
import com.logwatch.model.ApiKey;
import com.logwatch.model.Organisation;
import com.logwatch.model.User;
import com.logwatch.repository.ApiKeyRepository;
import com.logwatch.repository.OrganisationRepository;
import com.logwatch.repository.UserRepository;
import com.logwatch.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final OrganisationRepository organisationRepository;
    private final ApiKeyRepository apiKeyRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Create Organisation
        Organisation organisation = Organisation.builder()
                .name(request.getOrganisationName())
                .build();
        organisation = organisationRepository.save(organisation);

        // Create User
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .organisation(organisation)
                .build();
        userRepository.save(user);

        // Create API Key
        String rawKey = UUID.randomUUID().toString();
        ApiKey apiKey = ApiKey.builder()
                .keyHash(passwordEncoder.encode(rawKey))
                .organisation(organisation)
                .isActive(true)
                .build();
        apiKeyRepository.save(apiKey);

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        String jwtToken = jwtUtils.generateToken(userDetails, organisation.getId());

        return AuthResponse.builder()
                .token(jwtToken)
                .apiKey(rawKey)
                .email(user.getEmail())
                .organisationName(organisation.getName())
                .build();
    }

    public AuthResponse authenticate(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        UserDetails userDetails = userDetailsService.loadUserByUsername(request.getEmail());
        String jwtToken = jwtUtils.generateToken(userDetails, user.getOrganisation().getId());
        return AuthResponse.builder()
                .token(jwtToken)
                .email(user.getEmail())
                .organisationName(user.getOrganisation().getName())
                .build();
    }

    @Transactional
    public String regenerateKey(UUID orgId) {
        // Deactivate old keys
        apiKeyRepository.findByOrganisationId(orgId).forEach(key -> {
            key.setIsActive(false);
            apiKeyRepository.save(key);
        });

        // Create new API Key
        Organisation organisation = organisationRepository.findById(orgId)
                .orElseThrow(() -> new RuntimeException("Organisation not found"));
        
        String rawKey = UUID.randomUUID().toString();
        ApiKey apiKey = ApiKey.builder()
                .keyHash(passwordEncoder.encode(rawKey))
                .organisation(organisation)
                .isActive(true)
                .build();
        apiKeyRepository.save(apiKey);
        
        return rawKey;
    }
}
