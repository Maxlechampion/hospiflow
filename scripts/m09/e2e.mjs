#!/usr/bin/env node
// HOSPIFLOW — M09 (4/4) : test de bout en bout — rapports & statistiques
import { spawn } from 'node:child_process';
import { API, log, ok, fail } from './helpers.mjs';

const ADMIN = { email: 'admin@hospiflow.local', password: 'hospiflow_admin' };
const SECRETARY = { email: 'secretaire@hospiflow.local', password: 'hospiflow_sec' };
const PORT = 8019;

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
  log('M09/5', 'Test de bout en bout — rapports');

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

// Test 1 : vue d'ensemble par défaut
    const overviewResponse = await fetch(baseUrl + '/api/reports/overview', {
      headers: authHeaders(adminToken),
    });

if (overviewResponse.status !== 200) {
      fail('Vue d\'ensemble : HTTP 200 attendu, reçu HTTP ' + overviewResponse.status + await detail(overviewResponse) + '.');
    }

const overview = (await overviewResponse.json()).report;

if (!overview.patients) {
      fail('Champ patients manquant dans le rapport.');
    }
    if (overview.patients.total <= 0) {
      fail('Aucun patient comptabilisé dans HREF (seed M03 requis).');
    }
    if (!overview.period) {
      fail('Champ period manquant dans le rapport.');
    }
    if (!overview.appointments_by_status) {
      fail('Champ appointments_by_status manquant dans le rapport.');
    }
    if (!overview.lab_requests_by_status) {
      fail('Champ lab_requests_by_status manquant dans le rapport.');
    }
    if (!overview.billing) {
      fail('Champ billing manquant dans le rapport.');
    }
    ok('Vue d\'ensemble par défaut (structure complète, patients HREF comptés)');

// Test 2 : période invalide
    const badPeriod = await fetch(baseUrl + '/api/reports/overview?from=2026-01-10&to=2026-01-01', {
      headers: authHeaders(adminToken),
    });

if (badPeriod.status !== 422) {
      fail('Période invalide : HTTP 422 attendu, reçu HTTP ' + badPeriod.status + await detail(badPeriod) + '.');
    }
    ok('Période invalide (fin avant début) rejetée (422)');

// Test 3 : période vide cohérente
    const oldResponse = await fetch(baseUrl + '/api/reports/overview?from=2020-01-01&to=2020-01-31', {
      headers: authHeaders(adminToken),
    });

if (oldResponse.status !== 200) {
      fail('Période 2020 : HTTP 200 attendu, reçu HTTP ' + oldResponse.status + await detail(oldResponse) + '.');
    }

const oldReport = (await oldResponse.json()).report;

if (oldReport.patients.new_in_period !== 0) {
      fail('Nouveaux patients fantômes en 2020 : ' + oldReport.patients.new_in_period + '.');
    }
    if (oldReport.consultations_in_period !== 0) {
      fail('Consultations fantômes en 2020 : ' + oldReport.consultations_in_period + '.');
    }
    if (oldReport.billing.paid_in_period !== 0) {
      fail('Encaissements fantômes en 2020 : ' + oldReport.billing.paid_in_period + '.');
    }
    ok('Période vide (janvier 2020) : tous les compteurs de période à zéro');

// Test 4 : revenus — cohérence des séries
    const revenueResponse = await fetch(baseUrl + '/api/reports/revenue', {
      headers: authHeaders(adminToken),
    });

if (revenueResponse.status !== 200) {
      fail('Revenus : HTTP 200 attendu, reçu HTTP ' + revenueResponse.status + await detail(revenueResponse) + '.');
    }

const revenue = (await revenueResponse.json()).report;

if (revenue.paid_total <= 0) {
      fail('Aucun encaissement comptabilisé — lancez d\'abord npm run m08.');
    }

let dailySum = 0;
    for (const day of revenue.daily) {
      dailySum += day.total;
    }
    if (dailySum !== revenue.paid_total) {
      fail('Séries quotidiennes incohérentes : somme ' + dailySum + ' ≠ total ' + revenue.paid_total + '.');
    }
    ok('Revenus : encaissements comptabilisés et série quotidienne cohérente');

// Test 5 : un encaissement du jour apparaît dans le rapport du jour
    const patientsData = await (await fetch(baseUrl + '/api/patients', {
      headers: authHeaders(adminToken),
    })).json();
    const hrefPatient = patientsData.patients.find((p) => p.local_code === 'P-HREF-0001');

if (!hrefPatient) fail('Patient P-HREF-0001 introuvable dans HREF.');

const today = new Date().toISOString().slice(0, 10);

const createResponse = await fetch(baseUrl + '/api/invoices', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        patient_id: hrefPatient.id,
        items: [{ label: 'Frais de rapport M09', quantity: 1, unit_price: 2500 }],
      }),
    });

if (createResponse.status !== 201) {
      fail('Facture de test : HTTP 201 attendu, reçu HTTP ' + createResponse.status + await detail(createResponse) + '.');
    }

const invoice = (await createResponse.json()).invoice;

const issueResponse = await fetch(baseUrl + '/api/invoices/' + invoice.id, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: 'issued' }),
    });

if (issueResponse.status !== 200) {
      fail('Émission facture de test : HTTP 200 attendu, reçu HTTP ' + issueResponse.status + await detail(issueResponse) + '.');
    }

const payResponse = await fetch(baseUrl + '/api/invoices/' + invoice.id + '/payments', {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ amount: 2500, method: 'cash' }),
    });

if (payResponse.status !== 200) {
      fail('Encaissement de test : HTTP 200 attendu, reçu HTTP ' + payResponse.status + await detail(payResponse) + '.');
    }

const todayRevenue = await (await fetch(
      baseUrl + '/api/reports/revenue?from=' + today + '&to=' + today,
      { headers: authHeaders(adminToken) }
    )).json();

if (todayRevenue.report.paid_total < 2500) {
      fail('L\'encaissement du jour n\'apparaît pas dans le rapport (' + todayRevenue.report.paid_total + ' < 2500).');
    }
    ok('Encaissement du jour reflété immédiatement dans le rapport quotidien');

// Test 6 : ventilation par mode de paiement
    const allowedMethods = ['cash', 'mobile_money', 'transfer'];

for (const entry of revenue.by_method) {
      if (!allowedMethods.includes(entry.method)) {
        fail('Mode de paiement inattendu : ' + entry.method + '.');
      }
    }

let methodSum = 0;
    for (const entry of revenue.by_method) {
      methodSum += entry.total;
    }
    if (methodSum !== revenue.paid_total) {
      fail('Ventilation par mode incohérente : somme ' + methodSum + ' ≠ total ' + revenue.paid_total + '.');
    }
    ok('Ventilation par mode de paiement valide et cohérente');

// Test 7 : stock — seuils bas et péremption
    const stockResponse = await fetch(baseUrl + '/api/reports/stock', {
      headers: authHeaders(adminToken),
    });

if (stockResponse.status !== 200) {
      fail('Stock : HTTP 200 attendu, reçu HTTP ' + stockResponse.status + await detail(stockResponse) + '.');
    }

const stock = (await stockResponse.json()).report;

if (!Array.isArray(stock.low_stock)) {
      fail('Champ low_stock manquant dans le rapport stock.');
    }
    if (!Array.isArray(stock.expiring_lots)) {
      fail('Champ expiring_lots manquant dans le rapport stock.');
    }

for (const item of stock.low_stock) {
      if (item.total_quantity > stock.low_stock_threshold) {
        fail('Médicament au-dessus du seuil listé comme bas : ' + item.drug + '.');
      }
    }

for (const lot of stock.expiring_lots) {
      if (lot.quantity <= 0) {
        fail('Lot en alerte avec quantité nulle : ' + lot.drug + '.');
      }
      if (lot.days_left > stock.expiring_window_days) {
        fail('Lot hors fenêtre d\'alerte listé : ' + lot.drug + ' (' + lot.days_left + ' jours).');
      }
    }
    ok('Stock : ' + stock.low_stock.length + ' médicament(s) bas, ' + stock.expiring_lots.length + ' lot(s) en alerte péremption');

// Test 8 : isolation inter-établissements
    const adminCsm = adminFacilities.facilities.find((f) => f.code === 'CSM');

if (!adminCsm) {
      ok('Isolation : admin mono-établissement, rapport limité à HREF');
    } else {
      const hrefPatientsTotal = overview.patients.total;

await switchFacility(adminToken, adminCsm.id);

const csmOverview = await (await fetch(baseUrl + '/api/reports/overview', {
        headers: authHeaders(adminToken),
      })).json();

if (csmOverview.report.patients.total === hrefPatientsTotal) {
        fail('Isolation non vérifiée : CSM et HREF montrent le même total (' + hrefPatientsTotal + ').');
      }

await switchFacility(adminToken, href.id);
      ok('Isolation HREF ↔ CSM : les rapports suivent l\'établissement actif');
    }

// Test 9 : secrétaire sans reports.view → 403 partout
    const secOverview = await fetch(baseUrl + '/api/reports/overview', {
      headers: authHeaders(secretaryToken),
    });
    if (secOverview.status !== 403) {
      fail('Rapports (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secOverview.status + await detail(secOverview) + '.');
    }

const secRevenue = await fetch(baseUrl + '/api/reports/revenue', {
      headers: authHeaders(secretaryToken),
    });
    if (secRevenue.status !== 403) {
      fail('Revenus (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secRevenue.status + await detail(secRevenue) + '.');
    }

const secStock = await fetch(baseUrl + '/api/reports/stock', {
      headers: authHeaders(secretaryToken),
    });
    if (secStock.status !== 403) {
      fail('Stock (secrétaire) : HTTP 403 attendu, reçu HTTP ' + secStock.status + await detail(secStock) + '.');
    }
    ok('Secrétaire sans reports.view : 3 rapports rejetés (403)');

// Test 10 : accès anonyme
    const anonResponse = await fetch(baseUrl + '/api/reports/overview', {
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
