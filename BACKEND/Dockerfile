# Build stage
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app

COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

COPY src .

RUN ./mvnw package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

ENV PORT=8084
EXPOSE 8084

ARG JAR_FILE=target/senda-vida-1.0.0.jar
COPY --from=builder /app/${JAR_FILE} app.jar

ENTRYPOINT ["java", "-jar", "app.jar"]
