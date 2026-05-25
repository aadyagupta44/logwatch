package com.logwatch.security;

import com.logwatch.repository.ApiKeyRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Slf4j
@RequiredArgsConstructor
public class ApiKeyFilter extends OncePerRequestFilter {

    private final ApiKeyRepository apiKeyRepository;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        log.info("[ApiKeyFilter] path={}", request.getServletPath());

        if (!request.getServletPath().startsWith("/api/ingest")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String rawKey = request.getHeader("X-API-Key");
        log.info("[ApiKeyFilter] key_present={}", rawKey != null);

        if (rawKey == null || rawKey.isBlank()) {
            log.warn("[ApiKeyFilter] No X-API-Key header on /api/ingest request");
            filterChain.doFilter(request, response);
            return;
        }

        boolean found = apiKeyRepository.findByKeyHashAndIsActive(rawKey.trim(), true).map(apiKey -> {
            ApiKeyAuthenticationToken authentication = new ApiKeyAuthenticationToken(
                    apiKey.getOrganisation().getId(),
                    Collections.singletonList(new SimpleGrantedAuthority("ROLE_API_CLIENT"))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
            return true;
        }).orElse(false);

        log.info("[ApiKeyFilter] key_matched={}", found);
        filterChain.doFilter(request, response);
    }
}
