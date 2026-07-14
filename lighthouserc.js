module.exports = {
  ci: {
    collect: {
      // Configuración para recolectar las métricas ejecutando un servidor estático de producción
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready in',
      url: ['http://localhost:3000'],
      numberOfRuns: 3,
    },
    assert: {
      // Se reportan umbrales de calidad sin bloquear el deploy.
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      // El workflow conserva este directorio como artefacto de GitHub Actions.
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
