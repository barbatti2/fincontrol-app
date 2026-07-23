const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function formatBRL(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Roda todo dia às 09:00 (horário de Brasília).
 * Olha as contas de todos os usuários no Firestore, e envia um push
 * para quem tem uma conta vencendo em 3 dias ou em 1 dia.
 */
exports.checkDueBills = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'America/Sao_Paulo' },
  async () => {
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
    return null;
  }
);
