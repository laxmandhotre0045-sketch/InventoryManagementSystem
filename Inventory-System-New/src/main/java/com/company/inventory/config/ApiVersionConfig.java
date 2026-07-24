package com.company.inventory.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Applies the central API prefix (e.g. "/api/v1") to every controller in the
 * {@code com.company.inventory.controller} package.
 *
 * Controllers declare only their resource path (e.g. @RequestMapping("/equipment"));
 * the version prefix is added here from {@link ApiProperties}, so bumping the version
 * in one place re-maps all endpoints. Swagger/OpenAPI routes are in other packages
 * and are intentionally left un-prefixed.
 */
@Configuration
public class ApiVersionConfig implements WebMvcConfigurer {

    private static final String CONTROLLER_BASE_PACKAGE = "com.company.inventory.controller";

    private final ApiProperties apiProperties;

    public ApiVersionConfig(ApiProperties apiProperties) {
        this.apiProperties = apiProperties;
    }

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.addPathPrefix(
                apiProperties.getPrefix(),
                HandlerTypePredicate.forBasePackage(CONTROLLER_BASE_PACKAGE));
    }
}
