const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export async function api(path, { method = 'GET', body, token, facilityId } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(facilityId ? { 'X-Facility-Id': String(facilityId) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const data = await response.json().catch(() => ({}));

if (!response.ok) {
    throw new Error(
      data.message ||
        (data.errors && Object.values(data.errors).flat().join(' ')) ||
        `Erreur HTTP ${response.status}`
    );
  }

return data;
}
