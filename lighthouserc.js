module.exports = {
  ci: {
    collect: {
      // Configuración para recolectar las métricas ejecutando un servidor estático de producción
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'ready on',
      url: ['http://localhost:3000'],
      numberOfRuns: 3,
    },
    assert: {
      // Afirmaciones estrictas: buscamos mínimo 90 en cada categoría
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      // Dónde subir los reportes de Lighthouse.
      // Usamos el almacenamiento temporal gratuito para ver reportes en PRs.
      target: 'temporary-public-storage',
    },
  },
};
