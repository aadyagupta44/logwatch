package com.logwatch.controller;

import com.logwatch.security.JwtAuthenticationToken;
import com.logwatch.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/keys")
@RequiredArgsConstructor
@Tag(name = "API Keys", description = "Endpoints for API key management")
@SecurityRequirement(name = "bearerAuth")
public class ApiKeyController {

    private final AuthService authService;

    @PostMapping("/regenerate")
    @Operation(summary = "Regenerate the API key for the current organisation")
    public ResponseEntity<Map<String, String>> regenerateKey() {
        String newKey = authService.regenerateKey(getOrgId());
        return ResponseEntity.ok(Map.of("apiKey", newKey));
    }

    private UUID getOrgId() {
        JwtAuthenticationToken auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        return auth.getOrgId();
    }
}
