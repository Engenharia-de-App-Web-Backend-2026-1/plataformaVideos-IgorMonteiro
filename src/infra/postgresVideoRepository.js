'use strict';

const { Pool } = require('pg');
const config = require('./config');

function createPostgresVideoRepository() {
  const pool = new Pool({ connectionString: config.databaseUrl });

  return {
    // Grava o vídeo e enfileira o job de processamento na MESMA transação
    // ACID (tabela `outbox`), em vez de gravar no banco e publicar no AMQP
    // como dois passos separados (Dual-Write — ver README, ADR
    // "Transactional Outbox"). Ou os dois commitam, ou nenhum dos dois.
    async saveWithJob(video, job) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO videos (id, original_filename, storage_path, status, progress)
           VALUES ($1, $2, $3, $4, $5)`,
          [video.id, video.originalFilename, video.storagePath, video.status, JSON.stringify(video.progress)],
        );
        await client.query('INSERT INTO outbox (payload) VALUES ($1)', [JSON.stringify(job)]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async updateStatus(id, status) {
      await pool.query('UPDATE videos SET status = $1, updated_at = now() WHERE id = $2', [status, id]);
    },

    async findById(id) {
      const { rows } = await pool.query(
        `SELECT id, original_filename AS "originalFilename", storage_path AS "storagePath",
                status, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM videos WHERE id = $1`,
        [id],
      );
      return rows[0] || null;
    },
  };
}

module.exports = createPostgresVideoRepository;
