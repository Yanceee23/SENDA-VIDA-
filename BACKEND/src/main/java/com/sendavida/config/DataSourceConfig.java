package com.sendavida.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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
public class DataSourceConfig {

    @Bean
    @ConditionalOnExpression("T(java.lang.System).getenv('DATABASE_URL') != null && !T(java.lang.System).getenv('DATABASE_URL').isEmpty()")
    public DataSource dataSource(Environment env) throws Exception {
        String databaseUrl = env.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return null;
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

        String jdbcUrl = "jdbc:postgresql://" + dbUri.getHost() + ":" + dbUri.getPort() + dbUri.getPath();
        if (dbUri.getQuery() != null && !dbUri.getQuery().isEmpty()) {
            jdbcUrl += "?" + dbUri.getQuery();
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName("org.postgresql.Driver");

        return new HikariDataSource(config);
    }
}
