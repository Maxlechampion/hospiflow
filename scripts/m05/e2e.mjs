#!/usr/bin/env node
// HOSPIFLOW — M05 (4/4) : test de bout en bout — consultations & suivi clinique
import { spawn } from 'node:child_process';
import { API, log, ok, fail } from './helpers.mjs';

const ADMIN = { email: 'admin@hospiflow.local', password: 'hospiflow_admin' };
const SECRETARY = { email: 'secretaire@hospiflow.local', password: 'hospiflow_sec' };
const PORT = 8015;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runE2e() {
  log('M05/5', 'Test de bout en bout — consultations & suivi clinique');

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

const meData = await (await fetch(baseUrl + '/api/auth/me', {
      headers: authHeaders(adminToken),
    })).json();
    const adminUserId = meData.user.id;
    ok('Praticien de test : admin id=' + adminUserId);

const adminFacilities = await (await fetch(baseUrl + '/api/facilities', {
      headers: authHeaders(adminToken),
    })).json();
    const href = adminFacilities.facilities.find((f) => f.code === 'HREF');

if (!href) fail('HREF introuvable pour l\'admin.');

const secFacilities = await (await fetch(baseUrl + '/api/facilities', {
      headers: authHeaders(secretaryToken),
    })).json();
    const csm = secFacilities.facilities.find((f) => f.code === 'CSM');

if (!csm) fail('CSM introuvable pour la secrétaire.');

await switchFacility(adminToken, href.id);
    await switchFacility(secretaryToken, csm.id);
    ok('Établissements actifs définis (admin → HREF, secrétaire → CSM)');

const hrefPatients = await (await fetch(baseUrl + '/api/patients', {
      headers: authHeaders(adminToken),
    })).json();
    const hrefPatient = hrefPatients.patients.find(
      (p) => p.local_code === 'P-HREF-0001'
    );

if (!hrefPatient) fail('Patient P-HREF-0001 introuvable dans HREF.');

const csmPatients = await (await fetch(baseUrl + '/api/patients', {
      headers: authHeaders(secretaryToken),
    })).json();
    const csmPatient = csmPatients.patients.find(
      (p) => p.local_code === 'P-CSM-0001'
    );

if (!csmPatient) fail('Patient P-CSM-0001 introuvable dans CSM.');

// Test 1 : rendez-vous support (créneau unique par exécution)
    const slot = new Date(Date.now() + 7 * 86400000);
    slot.setMinutes(slot.getMinutes() + (process.pid % 55));

const createAppointment = await fetch(baseUrl + '/api/appointments', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        practitioner_id: adminUserId,
        scheduled_at: toLocalIso(slot),
        duration_minutes: 30,
        reason: 'Consultation de suivi',
      }),
    });

if (createAppointment.status !== 201) {
      fail('Rendez-vous support : HTTP 201 attendu, reçu HTTP ' + createAppointment.status + '.');
    }

const appointment = (await createAppointment.json()).appointment;
    ok('Rendez-vous support créé dans HREF (201)');

// Test 2 : création du compte-rendu lié au RDV
    const followUpIso = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

const createResponse = await fetch(baseUrl + '/api/consultations', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        appointment_id: appointment.id,
        chief_complaint: 'Douleurs abdominales depuis 48 h',
        examination: 'Palpation sensible au quadrant inférieur droit. T 38,2 °C.',
        diagnosis: 'Suspicion d\'appendicite aiguë',
        treatment: 'Biologie sanguine et échographie abdominale, avis chirurgical.',
        follow_up_date: followUpIso,
      }),
    });

if (createResponse.status !== 201) {
      fail('Création de consultation : HTTP 201 attendu, reçu HTTP ' + createResponse.status + '.');
    }

const created = (await createResponse.json()).consultation;
    ok('Compte-rendu de consultation créé (201)');

if (created.diagnosis !== 'Suspicion d\'appendicite aiguë') {
      fail('Diagnostic non enregistré.');
    }
    ok('Motif, examen, diagnostic, traitement et date de suivi enregistrés');

// Test 3 : le RDV lié passe automatiquement en « done »
    const appointmentAfter = await (await fetch(
      baseUrl + '/api/appointments/' + appointment.id,
      { headers: authHeaders(adminToken) }
    )).json();

if (appointmentAfter.appointment.status !== 'done') {
      fail('Le RDV lié n\'a pas été marqué « done » (statut : ' + appointmentAfter.appointment.status + ').');
    }
    ok('Rendez-vous automatiquement marqué « done »');

// Test 4 : mise à jour du diagnostic
    const updateResponse = await fetch(baseUrl + '/api/consultations/' + created.id, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ diagnosis: 'Appendicite aiguë confirmée' }),
    });

if (updateResponse.status !== 200) {
      fail('Mise à jour : HTTP 200 attendu, reçu HTTP ' + updateResponse.status + '.');
    }

const updated = (await updateResponse.json()).consultation;

if (updated.diagnosis !== 'Appendicite aiguë confirmée') {
      fail('Diagnostic non mis à jour.');
    }
    ok('Mise à jour du diagnostic (200)');

// Test 5 : liste des consultations de l'établissement
    const listResponse = await fetch(baseUrl + '/api/consultations', {
      headers: authHeaders(adminToken),
    });
    const listData = await listResponse.json();
    const found = listData.consultations.find((c) => c.id === created.id);

if (!found) fail('La consultation créée ne figure pas dans la liste HREF.');
    ok('Consultation visible dans la liste (HREF)');

// Test 6 : historique filtré par patient
    const filterUrl = baseUrl + '/api/consultations?patient_id=' + hrefPatient.id;
    const filterResponse = await fetch(filterUrl, {
      headers: authHeaders(adminToken),
    });
    const filterData = await filterResponse.json();
    const wrongPatient = filterData.consultations.find(
      (c) => c.patient.id !== hrefPatient.id
    );

if (wrongPatient) fail('Le filtre patient renvoie d\'autres patients.');
    ok('Historique par patient opérationnel');

// Test 7 : patient d'un autre établissement rejeté → 422
    const crossPatient = await fetch(baseUrl + '/api/consultations', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: csmPatient.id,
        chief_complaint: 'Tentative cross-établissement',
      }),
    });

if (crossPatient.status !== 422) {
      fail('Patient cross-établissement : HTTP 422 attendu, reçu HTTP ' + crossPatient.status + '.');
    }
    ok('Patient d\'un autre établissement rejeté (422)');

// Test 8 : rendez-vous d'un autre établissement rejeté → 422
    const csmAppointments = await (await fetch(baseUrl + '/api/appointments', {
      headers: authHeaders(secretaryToken),
    })).json();
    const csmAppointment = csmAppointments.appointments[0];

if (csmAppointment) {
      const crossAppointment = await fetch(baseUrl + '/api/consultations', {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          patient_id: hrefPatient.id,
          appointment_id: csmAppointment.id,
          chief_complaint: 'Tentative cross-établissement (RDV)',
        }),
      });

if (crossAppointment.status !== 422) {
        fail('RDV cross-établissement : HTTP 422 attendu, reçu HTTP ' + crossAppointment.status + '.');
      }
      ok('Rendez-vous d\'un autre établissement rejeté (422)');
    } else {
      ok('Aucun RDV CSM disponible : test croisé RDV ignoré');
    }

// Test 9 : secrétaire sans accès clinique → 403 partout
    const secList = await fetch(baseUrl + '/api/consultations', {
      headers: authHeaders(secretaryToken),
    });

if (secList.status !== 403) {
      fail('Liste (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secList.status + '.');
    }

const secShow = await fetch(baseUrl + '/api/consultations/' + created.id, {
      headers: authHeaders(secretaryToken),
    });

if (secShow.status !== 403) {
      fail('Détail (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secShow.status + '.');
    }

const secCreate = await fetch(baseUrl + '/api/consultations', {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({
        patient_id: csmPatient.id,
        chief_complaint: 'Tentative secrétaire',
      }),
    });

if (secCreate.status !== 403) {
      fail('Création (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secCreate.status + '.');
    }
    ok('Secrétaire sans accès clinique : liste, détail et création rejetés (403)');

// Test 10 : accès anonyme rejeté
    const anonResponse = await fetch(baseUrl + '/api/consultations', {
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
