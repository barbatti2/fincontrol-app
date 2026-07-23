const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function pad2(n) { return String(n).padStart(2, '0'); }
function monthKeyFromDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }
function addMonths(mk, delta) {
  const [y, m] = mk.split('-').map(Number);
  return monthKeyFromDate(new Date(y, m - 1 + delta, 1));
}
function formatBRL(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Reconstrói a lista de contas de um mês: as manuais (oneOffBills) mais as
 * recorrentes, calculadas na hora a partir do cadastro — igual ao app.
 */
function getMonthBills(data, monthKey) {
  const manual = ((data.oneOffBills && data.oneOffBills[monthKey]) || []);
  const recurring = (data.recurring || [])
    .filter((r) => r.startMonth <= monthKey)
    .map((r) => {
      const day = pad2(Math.min(r.day, 28));
      const status = data.recurringStatus && data.recurringStatus[r.id];
      const paid = !!(status && status[monthKey]);
      return { name: r.name, value: r.value, due: `${monthKey}-${day}`, paid };
    });
  return [...manual, ...recurring];
}

async function run() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = monthKeyFromDate(today);
  const nextMonth = addMonths(thisMonth, 1);

  const usersSnap = await db.collection('users').get();
  const sends = [];

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const tokens = data.fcmTokens || [];
    if (tokens.length === 0) return;

    [thisMonth, nextMonth].forEach((mk) => {
      getMonthBills(data, mk).forEach((bill) => {
        if (!bill || bill.paid) return;
        const due = new Date(bill.due + 'T00:00:00');
        const diffDays = Math.round((due - today) / 86400000);
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
