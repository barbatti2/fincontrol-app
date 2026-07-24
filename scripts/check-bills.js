const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function pad2(n) { return String(n).padStart(2, '0'); }

/**
 * Retorna a data de "hoje" no fuso de Brasília (America/Sao_Paulo), no
 * formato YYYY-MM-DD. Isso é essencial porque o robô roda nos servidores
 * do GitHub em UTC — sem isso, perto da meia-noite o "hoje" do robô pode
 * já estar um dia à frente do "hoje" real no Brasil.
 */
function todayBRDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addMonthsToKey(mk, delta) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** Diferença em dias de calendário entre duas datas YYYY-MM-DD (sem depender do fuso do servidor). */
function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T00:00:00Z');
  const b = new Date(dateStrB + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

function formatBRL(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Reconstrói a lista de contas de um mês: as manuais (oneOffBills) mais as
 * recorrentes, calculadas na hora a partir do cadastro, aplicando eventuais
 * ajustes de valor feitos só para aquele mês (recurringOverrides) — igual
 * à lógica usada no app.
 */
function getMonthBills(data, monthKey) {
  const manual = ((data.oneOffBills && data.oneOffBills[monthKey]) || []);
  const recurring = (data.recurring || [])
    .filter((r) => r.startMonth <= monthKey)
    .map((r) => {
      const day = pad2(Math.min(r.day, 28));
      const status = data.recurringStatus && data.recurringStatus[r.id];
      const paid = !!(status && status[monthKey]);
      const overrideMap = data.recurringOverrides && data.recurringOverrides[r.id];
      const override = overrideMap && overrideMap[monthKey];
      const value = override && override.value !== undefined ? override.value : r.value;
      return { name: r.name, value, due: `${monthKey}-${day}`, paid };
    });
  return [...manual, ...recurring];
}

async function run() {
  const todayStr = todayBRDateString();
  const thisMonth = todayStr.slice(0, 7);
  const nextMonth = addMonthsToKey(thisMonth, 1);

  console.log(`Hoje (Brasília): ${todayStr}`);

  const usersSnap = await db.collection('users').get();
  const sends = [];

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const tokens = data.fcmTokens || [];
    if (tokens.length === 0) return;

    [thisMonth, nextMonth].forEach((mk) => {
      getMonthBills(data, mk).forEach((bill) => {
        if (!bill || bill.paid) return;
        const diffDays = daysBetween(todayStr, bill.due);
        if (diffDays === 3 || diffDays === 1) {
          const body = `Sua conta "${bill.name}" vence em ${diffDays} dia${diffDays > 1 ? 's' : ''} (${formatBRL(bill.value)})`;
          tokens.forEach((token) => {
            sends.push(
              admin.messaging()
                .send({ token, notification: { title: 'FinControl', body } })
                .catch((err) => console.error('Erro ao enviar para token', token, err.message))
            );
          });
        }
      });
    });
  });

  await Promise.all(sends);
  console.log(`Verificação concluída. ${sends.length} notificação(ões) enviada(s).`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
