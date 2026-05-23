package com.logwatch.security;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.UUID;

public class JwtAuthenticationToken extends UsernamePasswordAuthenticationToken {
    private final UUID orgId;

    public JwtAuthenticationToken(UserDetails principal, UUID orgId, Collection<? extends GrantedAuthority> authorities) {
        super(principal, null, authorities);
        this.orgId = orgId;
    }

    public UUID getOrgId() {
        return orgId;
    }
}
