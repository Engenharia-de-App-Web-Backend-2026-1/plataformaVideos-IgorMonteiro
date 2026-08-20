'use strict';

function create({ videoId, stage, percent, status, outputPath }) {
  return {
    videoId,
    stage,
    percent: percent === null || percent === undefined ? null : Math.round(percent),
    status,
    // caminho (relativo ao volume compartilhado /app/storage) do arquivo que
    // essa etapa acabou de gerar — permite ao cliente mostrar onde o
    // resultado está sendo salvo, sem expor o filesystem do host.
    outputPath: outputPath || null,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { create };
