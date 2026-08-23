#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { installContentPlaneFetch } from './lib/content-plane-fetch.mjs';
import { ingestedArchiveTexts } from '../src/content/archive/index.js';
import { ARCHIVE_CERTIFICATION_SCHEMA } from '../src/content/archive/certification.js';
import DEFECT_REPORT from '../src/content/archive/defect-report.json';
import { inspectArchiveText } from '../src/core/archive-text-inspect.js';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

function excerpt(value, limit = 360) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

// Works are fetched by digest URL; Node has no origin to resolve them against.
installContentPlaneFetch();

const requestedWork = option('--work');
const output = resolve(option('--out') || 'out/release/archive-certification-candidates.json');
const candidates = ingestedArchiveTexts()
  .filter(work => !requestedWork || work.id === requestedWork);
if (requestedWork && candidates.length === 0) {
  throw new Error(`Unknown release candidate: ${requestedWork}`);
}

const packages = [];
for (const work of candidates) {
  const divisions = await work.getDivisions();
  const entries = divisions.entries || [];
  const body = entries.map(entry => entry.content || '').join('\n\n');
  const automated = inspectArchiveText(body);
  const signatureHits = DEFECT_REPORT.signatures
    .filter(signature => signature.works.includes(work.id))
    .map(signature => ({ id: signature.id, disposition: signature.disposition }));
  packages.push({
    work: {
      workId: work.workId,
      title: work.title,
      author: work.author,
      editionId: work.editionId,
      sourceRevision: work.sourceRevision,
      edition: work.edition,
      source: work.source,
      rights: work.rights,
      divisionCount: entries.length,
      opening: entries[0] ? {
        id: entries[0].id,
        label: entries[0].label,
        text: excerpt(entries[0].content)
      } : null,
      closing: entries.length ? {
        id: entries.at(-1).id,
        label: entries.at(-1).label,
        text: excerpt(entries.at(-1).content)
      } : null
    },
    automatedInspection: {
      ...automated,
      signatureHits
    },
    certificationTemplate: {
      schema: ARCHIVE_CERTIFICATION_SCHEMA,
      workId: work.workId,
      editionId: work.editionId,
      sourceRevision: work.sourceRevision,
      editionChoice: { kind: null, rationale: null },
      comparison: {
        reference: work.source?.url || null,
        completedAt: null,
        structural: false,
        token: false
      },
      dispositions: { reviewer: null, completedAt: null, count: null },
      detectors: {
        registryRevision: DEFECT_REPORT.generatedBy,
        allZero: false
      },
      certifiedAt: null
    }
  });
}

const document = {
  schema: 'rise.archive-certification-package.v1',
  generatedAt: new Date().toISOString(),
  instructions: 'Review the exact edition and every detector disposition. Automation must not change false/null certification fields.',
  candidates: packages
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Wrote ${packages.length} certification candidate package(s) to ${output}`);
