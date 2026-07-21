# syntax=docker/dockerfile:1

###############################################################################
# Stage 1 — Build the Spring Boot application with Maven
###############################################################################
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Copy the POM first and pre-fetch dependencies so this layer is cached
# and only re-runs when pom.xml changes (much faster rebuilds).
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

# Now copy sources and build the executable jar (skip tests for image builds).
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q clean package -DskipTests \
    && cp target/*.jar app.jar

###############################################################################
# Stage 2 — Minimal runtime image
###############################################################################
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# wget (busybox, already present) is used by the container healthcheck.
# Create a dedicated non-root user and the uploads directory.
RUN addgroup -S spring && adduser -S spring -G spring \
    && mkdir -p /app/uploads \
    && chown -R spring:spring /app

# The executable (fat) jar. Main-Class from the manifest is used by `java -jar`,
# so this works regardless of Spring Boot version.
COPY --from=build --chown=spring:spring /workspace/app.jar app.jar

USER spring

EXPOSE 8080

# Container-friendly JVM defaults; override with JAVA_OPTS at runtime if needed.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseContainerSupport"

# /v3/api-docs is a permitAll endpoint, so a 200 here means the app is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
    CMD wget -q --spider http://localhost:8080/v3/api-docs || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
