'use strict';

const config = require('../infra/config');

async function transcribe({ videoId, audioPath }) {
  const response = await fetch(`${config.transcriptionApiUrl}/transcriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, audioPath }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`serviço de legendagem respondeu ${response.status}`);
  }

  return response.json();
}

module.exports = { transcribe };
