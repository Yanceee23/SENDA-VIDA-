package com.sendavida.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.AutoConfigureBefore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * Configura el DataSource a partir de DATABASE_URL (formato Render/Heroku)
 * cuando está presente. En desarrollo local, Spring Boot usa application.properties.
 */
@Configuration
@AutoConfigureBefore(DataSourceAutoConfiguration.class)
public class DataSourceConfig {

    @Bean
    @Primary
    @ConditionalOnProperty(name = "DATABASE_URL")
    public DataSource dataSource(Environment env) throws Exception {
        String databaseUrl = env.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return null;
        }

        // Normalizar esquema postgres -> postgresql para URI
        if (databaseUrl.startsWith("postgres://")) {
            databaseUrl = "postgresql://" + databaseUrl.substring(11);
        }
        URI dbUri = new URI(databaseUrl);
        String userInfo = dbUri.getUserInfo();
        String username;
        String password;
        if (userInfo != null && userInfo.contains(":")) {
            int sep = userInfo.indexOf(':');
            username = URLDecoder.decode(userInfo.substring(0, sep), StandardCharsets.UTF_8);
            password = URLDecoder.decode(userInfo.substring(sep + 1), StandardCharsets.UTF_8);
        } else {
            username = userInfo != null ? userInfo : "";
            password = "";
        }

        int port = dbUri.getPort() > 0 ? dbUri.getPort() : 5432;
        String jdbcUrl = "jdbc:postgresql://" + dbUri.getHost() + ":" + port + dbUri.getPath();
        String query = dbUri.getQuery();
        if (query != null && !query.isEmpty()) {
            jdbcUrl += "?" + query;
        } else if (dbUri.getHost() != null && dbUri.getHost().contains(".render.com")) {
            // Render PostgreSQL requiere SSL
            jdbcUrl += "?sslmode=require";
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName("org.postgresql.Driver");

        return new HikariDataSource(config);
    }
}
