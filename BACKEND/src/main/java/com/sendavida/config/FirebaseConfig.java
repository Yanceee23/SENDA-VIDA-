package com.sendavida.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;

@Configuration
@Slf4j
public class FirebaseConfig {

    private final ResourceLoader resourceLoader;

    @Value("${firebase.config:}")
    private String firebaseConfigLocation;

    public FirebaseConfig(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    public void initFirebase() {
        if (firebaseConfigLocation == null || firebaseConfigLocation.isBlank()) {
            log.info("Firebase deshabilitado: propiedad firebase.config vacía.");
            return;
        }
        if (!FirebaseApp.getApps().isEmpty()) return;

        Resource resource = resourceLoader.getResource(firebaseConfigLocation);
        if (!resource.exists()) {
            log.warn("Firebase no inicializado (no existe {}): se continúa sin FCM.", firebaseConfigLocation);
            return;
        }

        try (InputStream in = resource.getInputStream()) {
            FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(in))
                .build();
            FirebaseApp.initializeApp(options);
            log.info("Firebase inicializado correctamente.");
        } catch (Exception e) {
            log.warn("Firebase no inicializado ({}): se continúa sin FCM.", e.getMessage());
        }
    }
}

