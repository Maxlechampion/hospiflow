#!/usr/bin/env node
// HOSPIFLOW — M07 (4/4) : test de bout en bout — pharmacie & dispensation
import { spawn } from 'node:child_process';
import { API, log, ok, fail } from './helpers.mjs';

const ADMIN = { email: 'admin@hospiflow.local', password: 'hospiflow_admin' };
const SECRETARY = { email: 'secretaire@hospiflow.local', password: 'hospiflow_sec' };
const DRUG_NAME = 'Paracétamol';
const PORT = 8017;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runE2e() {
  log('M07/5', 'Test de bout en bout — pharmacie & dispensation');

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

// Test 1 : médicament au catalogue (créé si absent — reruns idempotents)
    const drugsResponse = await fetch(baseUrl + '/api/pharmacy/drugs', {
      headers: authHeaders(adminToken),
    });
    const drugsData = await drugsResponse.json();
    let drug = drugsData.drugs.find((d) => d.name === DRUG_NAME);

if (!drug) {
      const createDrug = await fetch(baseUrl + '/api/pharmacy/drugs', {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          name: DRUG_NAME,
          form: 'comprimé',
          dosage: '500 mg',
          unit: 'comprimé',
        }),
      });

if (createDrug.status !== 201) {
        fail('Catalogue : HTTP 201 attendu, reçu HTTP ' + createDrug.status + '.');
      }

drug = (await createDrug.json()).drug;
    }
    ok('Médicament au catalogue : ' + drug.name + ' (id=' + drug.id + ')');

// Test 2 : entrée de stock (lot de 100, péremption lointaine)
    const beforeStock = await (await fetch(baseUrl + '/api/pharmacy/stock', {
      headers: authHeaders(adminToken),
    })).json();
    const beforeTotal = beforeStock.lots
      .filter((lot) => lot.drug.id === drug.id && !lot.expired)
      .reduce((sum, lot) => sum + lot.quantity, 0);

const addLot = await fetch(baseUrl + '/api/pharmacy/stock', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        drug_id: drug.id,
        lot_number: 'LOT-' + Date.now(),
        quantity: 100,
        expires_at: isoDate(300),
      }),
    });

if (addLot.status !== 201) {
      fail('Entrée de stock : HTTP 201 attendu, reçu HTTP ' + addLot.status + '.');
    }
    ok('Lot de 100 ' + drug.unit + 's ajouté au stock HREF (201)');

// Test 3 : dispensation partielle → décrément vérifié
    const dispensePartial = await fetch(baseUrl + '/api/pharmacy/dispensations', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        drug_id: drug.id,
        quantity: 20,
        notes: '1 comprimé 3 fois par jour',
      }),
    });

if (dispensePartial.status !== 201) {
      fail('Dispensation : HTTP 201 attendu, reçu HTTP ' + dispensePartial.status + '.');
    }

const partial = await dispensePartial.json();

if (partial.dispensation.patient.local_code !== 'P-HREF-0001') {
      fail('Patient incorrect sur la dispensation.');
    }

if (partial.dispensation.dispensed_by !== 'Admin') {
      if (!partial.dispensation.dispensed_by) fail('Dispensateur absent du rendu.');
    }

const afterStock = await (await fetch(baseUrl + '/api/pharmacy/stock', {
      headers: authHeaders(adminToken),
    })).json();
    const afterTotal = afterStock.lots
      .filter((lot) => lot.drug.id === drug.id && !lot.expired)
      .reduce((sum, lot) => sum + lot.quantity, 0);

if (afterTotal !== beforeTotal + 100 - 20) {
      fail('Décrément de stock incorrect : attendu ' + (beforeTotal + 80) + ', trouvé ' + afterTotal + '.');
    }

if (partial.remaining_stock !== afterTotal) {
      fail('Stock restant incohérent entre la réponse et la liste.');
    }
    ok('Dispensation de 20 enregistrée, stock décrémenté (' + afterTotal + ' restants)');

// Test 4 : dispensation du reste → stock épuisé
    const dispenseRest = await fetch(baseUrl + '/api/pharmacy/dispensations', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        drug_id: drug.id,
        quantity: afterTotal,
      }),
    });

if (dispenseRest.status !== 201) {
      fail('Dispensation complète : HTTP 201 attendu, reçu HTTP ' + dispenseRest.status + '.');
    }

const rest = await dispenseRest.json();

if (rest.remaining_stock !== 0) {
      fail('Stock restant attendu : 0, trouvé ' + rest.remaining_stock + '.');
    }
    ok('Stock épuisé proprement (remaining 0)');

// Test 5 : sur-dispensation → 422
    const overDispense = await fetch(baseUrl + '/api/pharmacy/dispensations', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        drug_id: drug.id,
        quantity: 1,
      }),
    });

if (overDispense.status !== 422) {
      fail('Sur-dispensation : HTTP 422 attendu, reçu HTTP ' + overDispense.status + '.');
    }
    ok('Dispensation au-delà du stock rejetée (422)');

// Test 6 : lot proche de péremption → signalé
    const expiringLot = await fetch(baseUrl + '/api/pharmacy/stock', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        drug_id: drug.id,
        lot_number: 'EXP-' + Date.now(),
        quantity: 10,
        expires_at: isoDate(10),
      }),
    });

if (expiringLot.status !== 201) {
      fail('Lot proche péremption : HTTP 201 attendu, reçu HTTP ' + expiringLot.status + '.');
    }

const expiringList = await (await fetch(
      baseUrl + '/api/pharmacy/stock?expiring_days=30',
      { headers: authHeaders(adminToken) }
    )).json();
    const flagged = expiringList.lots.find((lot) => lot.expiring_soon);

if (!flagged) fail('Aucun lot signalé en péremption proche.');
    ok('Lot proche de péremption signalé (expiring_soon)');

// Test 7 : patient d'un autre établissement → 422
    const crossPatient = await fetch(baseUrl + '/api/pharmacy/dispensations', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: csmPatient.id,
        drug_id: drug.id,
        quantity: 1,
      }),
    });

if (crossPatient.status !== 422) {
      fail('Patient cross-établissement : HTTP 422 attendu, reçu HTTP ' + crossPatient.status + '.');
    }
    ok('Patient d\'un autre établissement rejeté (422)');

// Test 8 : historique filtré par patient + détail
    const historyResponse = await fetch(
      baseUrl + '/api/pharmacy/dispensations?patient_id=' + hrefPatient.id,
      { headers: authHeaders(adminToken) }
    );
    const historyData = await historyResponse.json();
    const wrongPatient = historyData.dispensations.find(
      (d) => d.patient.id !== hrefPatient.id
    );

if (wrongPatient) fail('Le filtre patient renvoie d\'autres patients.');
    ok('Historique des dispensations filtré par patient opérationnel');

const detailResponse = await fetch(
      baseUrl + '/api/pharmacy/dispensations/' + partial.dispensation.id,
      { headers: authHeaders(adminToken) }
    );

if (detailResponse.status !== 200) {
      fail('Détail dispensation : HTTP 200 attendu, reçu HTTP ' + detailResponse.status + '.');
    }

const wrongId = await fetch(baseUrl + '/api/pharmacy/dispensations/999999', {
      headers: authHeaders(adminToken),
    });

if (wrongId.status !== 404) {
      fail('Dispensation inexistante : HTTP 404 attendu, reçu HTTP ' + wrongId.status + '.');
    }
    ok('Détail dispensation accessible, id hors périmètre introuvable (200/404)');

// Test 9 : secrétaire sans accès pharmacie
    const secStock = await fetch(baseUrl + '/api/pharmacy/stock', {
      headers: authHeaders(secretaryToken),
    });

if (secStock.status !== 403) {
      fail('Stock (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secStock.status + '.');
    }

const secDispense = await fetch(baseUrl + '/api/pharmacy/dispensations', {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({
        patient_id: csmPatient.id,
        drug_id: drug.id,
        quantity: 1,
      }),
    });

if (secDispense.status !== 403) {
      fail('Dispensation (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secDispense.status + '.');
    }
    ok('Secrétaire sans accès pharmacie : stock et dispensation rejetés (403)');

// Test 10 : accès anonyme
    const anonResponse = await fetch(baseUrl + '/api/pharmacy/drugs', {
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
