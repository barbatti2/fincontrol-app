const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function formatBRL(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function run() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const usersSnap = await db.collection('users').get();
  const sends = [];

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const tokens = data.fcmTokens || [];
    if (tokens.length === 0) return;

    const billsMap = data.bills || {};
    Object.values(billsMap).flat().forEach((bill) => {
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

  await Promise.all(sends);
  console.log(`Verificação concluída. ${sends.length} notificação(ões) enviada(s).`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
