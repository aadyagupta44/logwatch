package com.logwatch.security;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;
import java.util.UUID;

public class ApiKeyAuthenticationToken extends AbstractAuthenticationToken {
    private final UUID orgId;

    public ApiKeyAuthenticationToken(UUID orgId, Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.orgId = orgId;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return null;
    }

    @Override
    public Object getPrincipal() {
        return orgId;
    }

    public UUID getOrgId() {
        return orgId;
    }
}
