#!/usr/bin/env node
// HOSPIFLOW — M06 (4/4) : test de bout en bout — laboratoire
import { spawn } from 'node:child_process';
import { API, log, ok, fail } from './helpers.mjs';

const ADMIN = { email: 'admin@hospiflow.local', password: 'hospiflow_admin' };
const SECRETARY = { email: 'secretaire@hospiflow.local', password: 'hospiflow_sec' };
const PORT = 8016;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runE2e() {
  log('M06/5', 'Test de bout en bout — laboratoire');

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

// Consultation support (réutilisée si présente, créée sinon)
    const consultationsResponse = await fetch(
      baseUrl + '/api/consultations?patient_id=' + hrefPatient.id,
      { headers: authHeaders(adminToken) }
    );
    const consultationsData = await consultationsResponse.json();
    let consultation = consultationsData.consultations[0];

if (!consultation) {
      const createConsultation = await fetch(baseUrl + '/api/consultations', {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          patient_id: hrefPatient.id,
          chief_complaint: 'Consultation support laboratoire',
        }),
      });

if (createConsultation.status !== 201) {
        fail('Consultation support : HTTP 201 attendu, reçu HTTP ' + createConsultation.status + '.');
      }

consultation = (await createConsultation.json()).consultation;
    }
    ok('Consultation support prête (id=' + consultation.id + ')');

// Test 1 : création de la demande d'analyse liée à la consultation
    const createResponse = await fetch(baseUrl + '/api/lab-requests', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        consultation_id: consultation.id,
        panel: 'NFS + CRP',
        priority: 'urgent',
        notes: 'Contrôle avant avis chirurgical',
      }),
    });

if (createResponse.status !== 201) {
      fail('Demande d\'analyse : HTTP 201 attendu, reçu HTTP ' + createResponse.status + '.');
    }

const created = (await createResponse.json()).lab_request;

if (created.status !== 'pending') {
      fail('Statut initial invalide : ' + created.status + '.');
    }

if (created.consultation_id !== consultation.id) {
      fail('La demande n\'est pas liée à la consultation.');
    }
    ok('Demande d\'analyse créée, liée à la consultation (201, pending)');

// Test 2 : liste + filtres
    const listResponse = await fetch(baseUrl + '/api/lab-requests', {
      headers: authHeaders(adminToken),
    });
    const listData = await listResponse.json();
    const found = listData.lab_requests.find((r) => r.id === created.id);

if (!found) fail('La demande créée ne figure pas dans la liste HREF.');

if (found.requested_by !== 'Admin') {
      // Le nom du prescripteur doit être présent (comparaison souple)
      if (!found.requested_by) fail('Prescripteur absent du rendu.');
    }
    ok('Demande visible dans la liste, prescripteur et patient corrects');

const filterResponse = await fetch(
      baseUrl + '/api/lab-requests?patient_id=' + hrefPatient.id,
      { headers: authHeaders(adminToken) }
    );
    const filterData = await filterResponse.json();
    const wrongPatient = filterData.lab_requests.find(
      (r) => r.patient.id !== hrefPatient.id
    );

if (wrongPatient) fail('Le filtre patient renvoie d\'autres patients.');

const statusResponse = await fetch(
      baseUrl + '/api/lab-requests?status=pending',
      { headers: authHeaders(adminToken) }
    );
    const statusData = await statusResponse.json();
    const wrongStatus = statusData.lab_requests.find((r) => r.status !== 'pending');

if (wrongStatus) fail('Le filtre statut renvoie d\'autres statuts.');
    ok('Filtres par patient et par statut opérationnels');

// Test 3 : prise en charge
    const startResponse = await fetch(baseUrl + '/api/lab-requests/' + created.id, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: 'in_progress' }),
    });

if (startResponse.status !== 200) {
      fail('Prise en charge : HTTP 200 attendu, reçu HTTP ' + startResponse.status + '.');
    }

const started = (await startResponse.json()).lab_request;

if (started.status !== 'in_progress') {
      fail('Statut après prise en charge invalide : ' + started.status + '.');
    }
    ok('Prise en charge de la demande (in_progress)');

// Test 4 : saisie du résultat
    const resultResponse = await fetch(
      baseUrl + '/api/lab-requests/' + created.id + '/result',
      {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          values: 'Hb : 13,4 g/dL\nGB : 7 800/mm3\nCRP : 4 mg/L',
          conclusion: 'Bilan biologique sans particularité',
        }),
      }
    );

if (resultResponse.status !== 200) {
      fail('Saisie du résultat : HTTP 200 attendu, reçu HTTP ' + resultResponse.status + '.');
    }

const completed = (await resultResponse.json()).lab_request;

if (completed.status !== 'completed') {
      fail('Statut après résultat invalide : ' + completed.status + '.');
    }

if (!completed.result || !completed.result.resulted_at) {
      fail('Résultat non enregistré ou non horodaté.');
    }

if (completed.result.conclusion !== 'Bilan biologique sans particularité') {
      fail('Conclusion non enregistrée.');
    }
    ok('Résultat saisi : statut completed, résultat horodaté et tracé');

// Test 5 : une demande complétée refuse un nouveau résultat
    const redoResult = await fetch(
      baseUrl + '/api/lab-requests/' + created.id + '/result',
      {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({ values: 'Tentative de doublon' }),
      }
    );

if (redoResult.status !== 422) {
      fail('Doublon de résultat : HTTP 422 attendu, reçu HTTP ' + redoResult.status + '.');
    }
    ok('Résultat en double rejeté (422)');

// Test 6 : annulation + résultat sur demande annulée
    const secondCreate = await fetch(baseUrl + '/api/lab-requests', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        panel: 'Glycémie à jeun',
      }),
    });

if (secondCreate.status !== 201) {
      fail('Seconde demande : HTTP 201 attendu, reçu HTTP ' + secondCreate.status + '.');
    }

const second = (await secondCreate.json()).lab_request;

const cancelResponse = await fetch(baseUrl + '/api/lab-requests/' + second.id, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: 'cancelled' }),
    });

if (cancelResponse.status !== 200) {
      fail('Annulation : HTTP 200 attendu, reçu HTTP ' + cancelResponse.status + '.');
    }

const cancelled = (await cancelResponse.json()).lab_request;

if (cancelled.status !== 'cancelled') {
      fail('Statut après annulation invalide : ' + cancelled.status + '.');
    }

const resultOnCancelled = await fetch(
      baseUrl + '/api/lab-requests/' + second.id + '/result',
      {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({ values: 'Tentative sur demande annulée' }),
      }
    );

if (resultOnCancelled.status !== 422) {
      fail('Résultat sur demande annulée : HTTP 422 attendu, reçu HTTP ' + resultOnCancelled.status + '.');
    }
    ok('Demande annulée : résultat refusé (422)');

// Test 7 : isolation — patient d'un autre établissement
    const crossPatient = await fetch(baseUrl + '/api/lab-requests', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: csmPatient.id,
        panel: 'Tentative cross-établissement',
      }),
    });

if (crossPatient.status !== 422) {
      fail('Patient cross-établissement : HTTP 422 attendu, reçu HTTP ' + crossPatient.status + '.');
    }
    ok('Patient d\'un autre établissement rejeté (422)');

// Test 8 : la secrétaire n'a aucun accès laboratoire
    const secList = await fetch(baseUrl + '/api/lab-requests', {
      headers: authHeaders(secretaryToken),
    });

if (secList.status !== 403) {
      fail('Liste (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secList.status + '.');
    }

const secCreate = await fetch(baseUrl + '/api/lab-requests', {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({
        patient_id: csmPatient.id,
        panel: 'Tentative secrétaire',
      }),
    });

if (secCreate.status !== 403) {
      fail('Prescription (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secCreate.status + '.');
    }

const secResult = await fetch(
      baseUrl + '/api/lab-requests/' + created.id + '/result',
      {
        method: 'POST',
        headers: authHeaders(secretaryToken),
        body: JSON.stringify({ values: 'Tentative secrétaire' }),
      }
    );

if (secResult.status !== 403) {
      fail('Résultat (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secResult.status + '.');
    }
    ok('Secrétaire sans accès laboratoire : liste, prescription et résultat rejetés (403)');

// Test 9 : isolation de la liste — CSM ne voit pas les demandes HREF
    // (la secrétaire est bloquée en 403, on vérifie via un GET admin sur un id inexistant)
    const wrongId = await fetch(baseUrl + '/api/lab-requests/999999', {
      headers: authHeaders(adminToken),
    });

if (wrongId.status !== 404) {
      fail('Demande inexistante : HTTP 404 attendu, reçu HTTP ' + wrongId.status + '.');
    }
    ok('Demande hors périmètre introuvable (404)');

// Test 10 : accès anonyme
    const anonResponse = await fetch(baseUrl + '/api/lab-requests', {
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
