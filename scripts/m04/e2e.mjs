#!/usr/bin/env node
// HOSPIFLOW — M04 (4/4) : test de bout en bout — rendez-vous & agenda
import { spawn } from 'node:child_process';
import { API, log, ok, fail } from './helpers.mjs';

const ADMIN = { email: 'admin@hospiflow.local', password: 'hospiflow_admin' };
const SECRETARY = { email: 'secretaire@hospiflow.local', password: 'hospiflow_sec' };
const PORT = 8013;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runE2e() {
  log('M04/5', 'Test de bout en bout — rendez-vous & agenda');

const baseUrl = 'http://127.0.0.1:' + PORT;

const server = spawn(
    'php',
    ['artisan', 'serve', '--host=127.0.0.1', '--port=' + PORT],
    { cwd: API, stdio: 'ignore', windowsHide: true }
  );

function authHeaders(token) {
    return {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

async function login(credentials) {
    const response = await fetch(baseUrl + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(credentials),
    });

if (!response.ok) {
      fail('Connexion impossible pour ' + credentials.email + ' (HTTP ' + response.status + ').');
    }

return (await response.json()).token;
  }

async function switchFacility(token, facilityId) {
    const response = await fetch(baseUrl + '/api/facilities/' + facilityId + '/switch', {
      method: 'POST',
      headers: authHeaders(token),
    });

if (response.status !== 200) {
      fail('Bascule d\'établissement refusée (HTTP ' + response.status + ').');
    }
  }

function toLocalIso(date) {
    return date.toISOString().slice(0, 16);
  }

try {
    let ready = false;

for (let attempt = 0; attempt < 30 && !ready; attempt += 1) {
      if (server.exitCode !== null) {
        fail('Le serveur Laravel s\'est arrêté (code ' + server.exitCode + ').');
      }
      try {
        const response = await fetch(baseUrl + '/api/health', {
          signal: AbortSignal.timeout(3000),
        });
        ready = response.ok;
      } catch {
        await sleep(1000);
      }
    }

if (!ready) fail('L\'API n\'a pas répondu sur le port ' + PORT + '.');
    ok('API en ligne');

const adminToken = await login(ADMIN);
    const secretaryToken = await login(SECRETARY);
    ok('Connexions admin et secrétaire OK');

const meResponse = await fetch(baseUrl + '/api/auth/me', {
      headers: authHeaders(adminToken),
    });
    const meData = await meResponse.json();
    const adminUserId = meData.user.id;
    ok('Praticien de test : admin id=' + adminUserId);

const secFacilities = await (await fetch(baseUrl + '/api/facilities', {
      headers: authHeaders(secretaryToken),
    })).json();
    const csm = secFacilities.facilities.find((f) => f.code === 'CSM');

if (!csm) fail('CSM introuvable pour la secrétaire.');

const adminFacilities = await (await fetch(baseUrl + '/api/facilities', {
      headers: authHeaders(adminToken),
    })).json();
    const href = adminFacilities.facilities.find((f) => f.code === 'HREF');

if (!href) fail('HREF introuvable pour l\'admin.');

await switchFacility(secretaryToken, csm.id);
    await switchFacility(adminToken, href.id);
    ok('Établissements actifs définis (secrétaire → CSM, admin → HREF)');

const patientsResponse = await fetch(baseUrl + '/api/patients', {
      headers: authHeaders(secretaryToken),
    });
    const patientsData = await patientsResponse.json();
    const demoPatient = patientsData.patients.find(
      (p) => p.local_code === 'P-CSM-0001'
    );

if (!demoPatient) fail('Patient P-CSM-0001 introuvable dans CSM.');

// Créneau « demain 09:00 » : recalculé à chaque exécution.
    const slot = new Date();
    slot.setDate(slot.getDate() + 1);
    slot.setHours(9, 0, 0, 0);
    const slotIso = toLocalIso(slot);

const overlap = new Date(slot.getTime() + 10 * 60 * 1000);
    const overlapIso = toLocalIso(overlap);

// Test 1 : création → 201
    const createResponse = await fetch(baseUrl + '/api/appointments', {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({
        patient_id: demoPatient.id,
        practitioner_id: adminUserId,
        scheduled_at: slotIso,
        duration_minutes: 30,
        reason: 'Consultation générale',
      }),
    });

if (createResponse.status !== 201) {
      fail('Création de rendez-vous : HTTP 201 attendu, reçu HTTP ' + createResponse.status + '.');
    }
    ok('Création de rendez-vous par la secrétaire (201)');

const created = (await createResponse.json()).appointment;

if (created.status !== 'scheduled') {
      fail('Statut initial invalide : ' + created.status + '.');
    }
    ok('Statut initial « scheduled »');

// Test 2 : liste
    const listResponse = await fetch(baseUrl + '/api/appointments', {
      headers: authHeaders(secretaryToken),
    });

if (listResponse.status !== 200) {
      fail('Liste rendez-vous : HTTP 200 attendu, reçu HTTP ' + listResponse.status + '.');
    }

const listData = await listResponse.json();
    const found = listData.appointments.find((a) => a.id === created.id);

if (!found) fail('Le rendez-vous créé ne figure pas dans la liste CSM.');
    ok('Rendez-vous visible dans la liste (CSM)');

if (found.patient.local_code !== 'P-CSM-0001') {
      fail('Le patient rattaché au rendez-vous est incorrect.');
    }

if (found.practitioner.id !== adminUserId) {
      fail('Le praticien rattaché au rendez-vous est incorrect.');
    }
    ok('Patient et praticien correctement rattachés');

// Test 3 : conflit → 422
    const conflictResponse = await fetch(baseUrl + '/api/appointments', {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({
        patient_id: demoPatient.id,
        practitioner_id: adminUserId,
        scheduled_at: overlapIso,
        duration_minutes: 30,
        reason: 'Tentative de chevauchement',
      }),
    });

if (conflictResponse.status !== 422) {
      fail('Conflit d\'agenda : HTTP 422 attendu, reçu HTTP ' + conflictResponse.status + '.');
    }
    ok('Créneau chevauchant rejeté par détection de conflit (422)');

// Test 4 : annulation
    const cancelResponse = await fetch(baseUrl + '/api/appointments/' + created.id, {
      method: 'PATCH',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({ status: 'cancelled' }),
    });

if (cancelResponse.status !== 200) {
      fail('Annulation : HTTP 200 attendu, reçu HTTP ' + cancelResponse.status + '.');
    }

const cancelled = (await cancelResponse.json()).appointment;

if (cancelled.status !== 'cancelled') {
      fail('Statut après annulation invalide : ' + cancelled.status + '.');
    }
    ok('Annulation du rendez-vous (statut « cancelled »)');

// Test 5 : le créneau annulé redevient disponible → 201
    const rebookResponse = await fetch(baseUrl + '/api/appointments', {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({
        patient_id: demoPatient.id,
        practitioner_id: adminUserId,
        scheduled_at: slotIso,
        duration_minutes: 30,
        reason: 'Reprise du créneau annulé',
      }),
    });

if (rebookResponse.status !== 201) {
      fail('Re-réservation du créneau : HTTP 201 attendu, reçu HTTP ' + rebookResponse.status + '.');
    }
    ok('Créneau annulé re-réservable (201)');

// Test 6 : isolation — l'admin (HREF) ne voit pas le RDV de CSM
    const hrefShowResponse = await fetch(baseUrl + '/api/appointments/' + created.id, {
      headers: authHeaders(adminToken),
    });

if (hrefShowResponse.status !== 404) {
      fail('Isolation : HTTP 404 attendu, reçu HTTP ' + hrefShowResponse.status + '.');
    }
    ok('Rendez-vous d\'un autre établissement inaccessible (404)');

const hrefListResponse = await fetch(baseUrl + '/api/appointments', {
      headers: authHeaders(adminToken),
    });
    const hrefList = await hrefListResponse.json();
    const leaked = hrefList.appointments.find((a) => a.id === created.id);

if (leaked) fail('Isolation rompue : le RDV de CSM apparaît dans la liste HREF.');
    ok('Le RDV de CSM est absent de la liste HREF');

// Test 7 : accès anonyme → 401
    const anonResponse = await fetch(baseUrl + '/api/appointments', {
      headers: { Accept: 'application/json' },
    });

if (anonResponse.status !== 401) {
      fail('Accès anonyme : HTTP 401 attendu, reçu HTTP ' + anonResponse.status + '.');
    }
    ok('Accès anonyme rejeté (401)');
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await sleep(300);
    }
  }
}
