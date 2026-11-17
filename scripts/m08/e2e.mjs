#!/usr/bin/env node
// HOSPIFLOW — M08 (4/4) : test de bout en bout — facturation & encaissements
import { spawn } from 'node:child_process';
import { API, log, ok, fail } from './helpers.mjs';

const ADMIN = { email: 'admin@hospiflow.local', password: 'hospiflow_admin' };
const SECRETARY = { email: 'secretaire@hospiflow.local', password: 'hospiflow_sec' };
const PORT = 8018;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function detail(response) {
  try {
    const body = await response.text();
    return body ? ' — réponse API : ' + body.slice(0, 400) : '';
  } catch {
    return '';
  }
}

export async function runE2e() {
  log('M08/5', 'Test de bout en bout — facturation');

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
      fail('Connexion impossible pour ' + credentials.email + ' (HTTP ' + response.status + await detail(response) + ').');
    }

return (await response.json()).token;
  }

async function switchFacility(token, facilityId) {
    const response = await fetch(baseUrl + '/api/facilities/' + facilityId + '/switch', {
      method: 'POST',
      headers: authHeaders(token),
    });

if (response.status !== 200) {
      fail('Bascule d\'établissement refusée (HTTP ' + response.status + await detail(response) + ').');
    }
  }

function isoDate(offsetDays) {
    return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
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

// Test 1 : création de facture — total et lignes vérifiés
    const createResponse = await fetch(baseUrl + '/api/invoices', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        due_date: isoDate(30),
        items: [
          { label: 'Consultation générale', quantity: 1, unit_price: 10000 },
          { label: 'Paracétamol 500 mg', quantity: 2, unit_price: 500 },
        ],
      }),
    });

if (createResponse.status !== 201) {
      fail('Création de facture : HTTP 201 attendu, reçu HTTP ' + createResponse.status + await detail(createResponse) + '.');
    }

const created = (await createResponse.json()).invoice;

if (created.status !== 'draft') {
      fail('Statut initial invalide : ' + created.status + '.');
    }

if (!created.number.startsWith('FAC-')) {
      fail('Numérotation invalide : ' + created.number + '.');
    }

if (created.total_amount !== 11000) {
      fail('Total incorrect : attendu 11000, reçu ' + created.total_amount + '.');
    }

if (created.items.length !== 2) {
      fail('Lignes manquantes : ' + created.items.length + ' reçue(s).');
    }

if (created.remaining_amount !== 11000) {
      fail('Reste à payer initial incorrect : ' + created.remaining_amount + '.');
    }
    ok('Facture ' + created.number + ' créée (draft, 2 lignes, total 11000 XOF)');

// Test 2 : encaissement refusé sur brouillon → 422
    const payDraft = await fetch(baseUrl + '/api/invoices/' + created.id + '/payments', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ amount: 1000, method: 'cash' }),
    });

if (payDraft.status !== 422) {
      fail('Paiement sur brouillon : HTTP 422 attendu, reçu HTTP ' + payDraft.status + await detail(payDraft) + '.');
    }
    ok('Encaissement sur brouillon rejeté (422)');

// Test 3 : émission puis paiement partiel
    const issueResponse = await fetch(baseUrl + '/api/invoices/' + created.id, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: 'issued' }),
    });

if (issueResponse.status !== 200) {
      fail('Émission : HTTP 200 attendu, reçu HTTP ' + issueResponse.status + await detail(issueResponse) + '.');
    }

const issued = (await issueResponse.json()).invoice;

if (issued.status !== 'issued') {
      fail('Statut après émission invalide : ' + issued.status + '.');
    }
    ok('Facture émise (issued)');

const partialResponse = await fetch(baseUrl + '/api/invoices/' + created.id + '/payments', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ amount: 6000, method: 'mobile_money' }),
    });

if (partialResponse.status !== 200) {
      fail('Paiement partiel : HTTP 200 attendu, reçu HTTP ' + partialResponse.status + await detail(partialResponse) + '.');
    }

const partial = (await partialResponse.json()).invoice;

if (partial.status !== 'issued') {
      fail('Statut après paiement partiel invalide : ' + partial.status + '.');
    }

if (partial.paid_amount !== 6000) {
      fail('Montant payé incorrect : attendu 6000, reçu ' + partial.paid_amount + '.');
    }

if (partial.remaining_amount !== 5000) {
      fail('Reste à payer incorrect : attendu 5000, reçu ' + partial.remaining_amount + '.');
    }
    ok('Paiement partiel de 6000 XOF (reste 5000, toujours issued)');

// Test 4 : sur-encaissement → 422
    const overPay = await fetch(baseUrl + '/api/invoices/' + created.id + '/payments', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ amount: 6000, method: 'cash' }),
    });

if (overPay.status !== 422) {
      fail('Sur-encaissement : HTTP 422 attendu, reçu HTTP ' + overPay.status + await detail(overPay) + '.');
    }
    ok('Encaissement supérieur au reste rejeté (422)');

// Test 5 : solde → paid
    const finalPay = await fetch(baseUrl + '/api/invoices/' + created.id + '/payments', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ amount: 5000, method: 'cash' }),
    });

if (finalPay.status !== 200) {
      fail('Solde : HTTP 200 attendu, reçu HTTP ' + finalPay.status + await detail(finalPay) + '.');
    }

const paid = (await finalPay.json()).invoice;

if (paid.status !== 'paid') {
      fail('Statut invalide après solde : ' + paid.status + '.');
    }

if (paid.remaining_amount !== 0) {
      fail('Reste à payer non nul : ' + paid.remaining_amount + '.');
    }
    ok('Facture soldée : statut paid, 2 paiements enregistrés');

// Test 6 : facture payée verrouillée → 422 sur toute transition
    const touchPaid = await fetch(baseUrl + '/api/invoices/' + created.id, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: 'cancelled' }),
    });

if (touchPaid.status !== 422) {
      fail('Facture payée : HTTP 422 attendu, reçu HTTP ' + touchPaid.status + await detail(touchPaid) + '.');
    }
    ok('Facture payée non modifiable (422)');

// Test 7 : annulation propre + paiement sur annulée refusé
    const secondCreate = await fetch(baseUrl + '/api/invoices', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        items: [{ label: 'Glycémie à jeun', quantity: 1, unit_price: 3000 }],
      }),
    });

if (secondCreate.status !== 201) {
      fail('Seconde facture : HTTP 201 attendu, reçu HTTP ' + secondCreate.status + await detail(secondCreate) + '.');
    }

const second = (await secondCreate.json()).invoice;

const cancelResponse = await fetch(baseUrl + '/api/invoices/' + second.id, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: 'cancelled' }),
    });

if (cancelResponse.status !== 200) {
      fail('Annulation : HTTP 200 attendu, reçu HTTP ' + cancelResponse.status + await detail(cancelResponse) + '.');
    }

const cancelled = (await cancelResponse.json()).invoice;

if (cancelled.status !== 'cancelled') {
      fail('Statut après annulation invalide : ' + cancelled.status + '.');
    }

const payCancelled = await fetch(baseUrl + '/api/invoices/' + second.id + '/payments', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ amount: 1000, method: 'cash' }),
    });

if (payCancelled.status !== 422) {
      fail('Paiement sur facture annulée : HTTP 422 attendu, reçu HTTP ' + payCancelled.status + await detail(payCancelled) + '.');
    }
    ok('Annulation propre (facture vierge) et paiement sur annulée refusé (422)');

// Test 8 : patient cross-établissement → 422 + filtres + 404
    const crossPatient = await fetch(baseUrl + '/api/invoices', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: csmPatient.id,
        items: [{ label: 'Tentative cross-établissement', quantity: 1, unit_price: 100 }],
      }),
    });

if (crossPatient.status !== 422) {
      fail('Patient cross-établissement : HTTP 422 attendu, reçu HTTP ' + crossPatient.status + await detail(crossPatient) + '.');
    }
    ok('Patient d\'un autre établissement rejeté (422)');

const listResponse = await fetch(baseUrl + '/api/invoices', {
      headers: authHeaders(adminToken),
    });
    const listData = await listResponse.json();
    const found = listData.invoices.find((i) => i.id === created.id);

if (!found) fail('La facture créée ne figure pas dans la liste HREF.');

const statusFilter = await (await fetch(
      baseUrl + '/api/invoices?status=paid',
      { headers: authHeaders(adminToken) }
    )).json();
    const wrongStatus = statusFilter.invoices.find((i) => i.status !== 'paid');

if (wrongStatus) fail('Le filtre statut renvoie d\'autres statuts.');

const patientFilter = await (await fetch(
      baseUrl + '/api/invoices?patient_id=' + hrefPatient.id,
      { headers: authHeaders(adminToken) }
    )).json();
    const wrongPatient = patientFilter.invoices.find(
      (i) => i.patient.id !== hrefPatient.id
    );

if (wrongPatient) fail('Le filtre patient renvoie d\'autres patients.');
    ok('Liste + filtres par statut et par patient opérationnels');

const wrongId = await fetch(baseUrl + '/api/invoices/999999', {
      headers: authHeaders(adminToken),
    });

if (wrongId.status !== 404) {
      fail('Facture inexistante : HTTP 404 attendu, reçu HTTP ' + wrongId.status + await detail(wrongId) + '.');
    }
    ok('Facture hors périmètre introuvable (404)');

// Test 9 : secrétaire sans accès facturation → 403
    const secList = await fetch(baseUrl + '/api/invoices', {
      headers: authHeaders(secretaryToken),
    });

if (secList.status !== 403) {
      fail('Liste (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secList.status + await detail(secList) + '.');
    }

const secCreate = await fetch(baseUrl + '/api/invoices', {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({
        patient_id: csmPatient.id,
        items: [{ label: 'Tentative secrétaire', quantity: 1, unit_price: 100 }],
      }),
    });

if (secCreate.status !== 403) {
      fail('Création (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secCreate.status + await detail(secCreate) + '.');
    }
    ok('Secrétaire sans accès facturation : liste et création rejetées (403)');

// Test 10 : accès anonyme
    const anonResponse = await fetch(baseUrl + '/api/invoices', {
      headers: { Accept: 'application/json' },
    });

if (anonResponse.status !== 401) {
      fail('Accès anonyme : HTTP 401 attendu, reçu HTTP ' + anonResponse.status + await detail(anonResponse) + '.');
    }
    ok('Accès anonyme rejeté (401)');
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await sleep(300);
    }
  }
}
