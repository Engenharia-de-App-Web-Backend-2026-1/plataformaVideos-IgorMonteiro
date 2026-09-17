'use strict';

const { Pool } = require('pg');
const config = require('./config');

// Consumido apenas pelo outbox relay (src/outboxRelay.js) — processo
// separado da API, então tem seu próprio pool de conexões.
function createPostgresOutboxRepository() {
  const pool = new Pool({ connectionString: config.databaseUrl });

  return {
    // Trava e despacha no máximo um evento pendente por chamada. `publish`
    // só é marcado como concluído (`published_at`) depois de confirmado —
    // se falhar, a transação é desfeita e o evento continua pendente para a
    // próxima tentativa (garantia at-least-once, ver README).
    // `FOR UPDATE SKIP LOCKED` permite múltiplas réplicas do relay
    // concorrentes sem publicar o mesmo evento duas vezes.
    async dispatchNextPendingJob(publish) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT id, payload FROM outbox
           WHERE published_at IS NULL
           ORDER BY id ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1`,
        );

        if (rows.length === 0) {
          await client.query('COMMIT');
          return false;
        }

        const { id, payload } = rows[0];
        await publish(payload);
        await client.query('UPDATE outbox SET published_at = now() WHERE id = $1', [id]);
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

module.exports = createPostgresOutboxRepository;
