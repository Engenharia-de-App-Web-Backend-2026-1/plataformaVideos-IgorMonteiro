'use strict';

const { Pool } = require('pg');
const config = require('./config');

function createPostgresVideoRepository() {
  const pool = new Pool({ connectionString: config.databaseUrl });

  return {
    async save(video) {
      await pool.query(
        `INSERT INTO videos (id, original_filename, storage_path, status, progress)
         VALUES ($1, $2, $3, $4, $5)`,
        [video.id, video.originalFilename, video.storagePath, video.status, JSON.stringify(video.progress)],
      );
    },
  };
}

module.exports = createPostgresVideoRepository;
