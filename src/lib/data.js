const MOCK_FILES = [
  'overview',
  'map-assets',
  'alerts',
  'videos',
  'terminal-details',
  'emergency-scenarios',
  'traffic-scenarios',
];

export async function loadMockData() {
  const entries = await Promise.all(
    MOCK_FILES.map(async (name) => {
      const response = await fetch(`/mock/${name}.json`);

      if (!response.ok) {
        throw new Error(`Failed to load mock data: ${name}`);
      }

      return [camelize(name), await response.json()];
    }),
  );

  return Object.fromEntries(entries);
}

function camelize(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
