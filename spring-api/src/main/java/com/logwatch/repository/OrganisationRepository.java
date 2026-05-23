package com.logwatch.repository;

import com.logwatch.model.Organisation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface OrganisationRepository extends JpaRepository<Organisation, UUID> {
}
