package com.logwatch.security;

import com.logwatch.model.ApiKey;
import com.logwatch.repository.ApiKeyRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ApiKeyFilter extends OncePerRequestFilter {

    private final ApiKeyRepository apiKeyRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        
        if (!request.getServletPath().startsWith("/api/ingest")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String rawKey = authHeader.substring(7);
        
        // Since we store hashes, we need to find the active keys and compare.
        // For performance, usually we'd have a prefix or something, but here we'll just check.
        // Actually, for simplicity in this demo, I'll assume we can find the key.
        // Ideally, ApiKey table should have a hint or we use a different storage.
        // But the prompt says "Validates the key against the ApiKey table".
        
        List<ApiKey> activeKeys = apiKeyRepository.findAll().stream()
                .filter(ApiKey::getIsActive)
                .toList();

        for (ApiKey apiKey : activeKeys) {
            if (passwordEncoder.matches(rawKey, apiKey.getKeyHash())) {
                // Found a match
                ApiKeyAuthenticationToken authentication = new ApiKeyAuthenticationToken(
                        apiKey.getOrganisation().getId(),
                        Collections.singletonList(new SimpleGrantedAuthority("ROLE_API_CLIENT"))
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
                break;
            }
        }

        filterChain.doFilter(request, response);
    }
}
