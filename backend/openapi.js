'use strict';

/**
 * Hand-written OpenAPI 3.1 document served at /api/docs via swagger-ui.
 *
 * Kept in JS so we can reference live route handlers / env vars where it
 * matters. Regenerate the JSON at runtime — no build step.
 */

const { SOROBAN_CONTRACT_ID } = (() => ({ SOROBAN_CONTRACT_ID: process.env.SOROBAN_CONTRACT_ID }))();

const envelope = (schemaRef) => ({
  type: 'object',
  required: ['success', 'data', 'error'],
  properties: {
    success: { type: 'boolean' },
    data: schemaRef,
    error: { type: ['string', 'null'] },
  },
});

module.exports = {
  openapi: '3.1.0',
  info: {
    title: 'AgriShield API',
    version: '1.0.0',
    description:
      'Satellite drought oracle for Sitapur smallholder farms. Real Sentinel-2 NDVI + Open-Meteo rainfall feed an AND-threshold drought evaluator; positive evaluations fire Soroban trigger_payout on Stellar testnet.',
    contact: { name: 'AgriShield', url: 'https://github.com/garvsultania/agrishield' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local dev' },
    { url: 'https://api.agrishield.example.com', description: 'Production (placeholder)' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Set `ADMIN_API_TOKEN` in backend/.env to require Bearer on /simulate. Unset = dev mode (open).',
      },
    },
    schemas: {
      Farm: {
        type: 'object',
        properties: {
          farmId: { type: 'string', example: 'SITAPUR_001' },
          farmerName: { type: 'string', example: 'Ramesh Kumar' },
          coordinates: {
            type: 'object',
            properties: {
              lat: { type: 'number', example: 27.5706 },
              lng: { type: 'number', example: 80.6822 },
            },
          },
          polygon: { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } },
          areaSqKm: { type: 'number', example: 0.5 },
          cropType: { type: 'string', example: 'wheat' },
          walletAddress: { type: 'string', example: 'GDU34N2INDZ2OZS5LLKJFKQGNWT2RIIXJZLYMRVQ44DB4TCFMO56SWG3' },
        },
      },
      DailyObservation: {
        type: 'object',
        properties: {
          farmId: { type: 'string' },
          coordinates: { $ref: '#/components/schemas/Farm/properties/coordinates' },
          observation_date: { type: 'string', format: 'date' },
          ndvi: { type: 'number' },
          rainfall_mm: { type: 'number' },
          soil_moisture: { type: 'number' },
          ndvi_source: { type: 'string', enum: ['sentinel-2', 'sentinel-2-interp', 'mock'] },
          rainfall_source: { type: 'string', enum: ['open-meteo', 'mock'] },
          source: { type: 'string', enum: ['real', 'hybrid', 'mock'] },
          ndvi_scene: {
            type: ['object', 'null'],
            properties: {
              sceneId: { type: ['string', 'null'] },
              sceneDate: { type: 'string' },
              cloud: { type: 'number' },
            },
          },
        },
      },
      DroughtEvaluation: {
        type: 'object',
        properties: {
          triggered: { type: 'boolean' },
          reason: { type: 'string' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          proof_of_loss: {
            type: 'object',
            properties: {
              avg_ndvi: { type: 'number' },
              avg_rainfall_mm: { type: 'number' },
              min_ndvi: { type: 'number' },
              max_rainfall_mm: { type: 'number' },
              days_evaluated: { type: 'integer' },
              ndvi_threshold: { type: 'number', example: 0.35 },
              rainfall_threshold_mm: { type: 'number', example: 10 },
              observation_window: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date' },
                  end: { type: 'string', format: 'date' },
                },
              },
              data_source: { type: 'string' },
            },
          },
        },
      },
      FarmStatus: {
        type: 'object',
        properties: {
          farmId: { type: 'string' },
          farmerName: { type: 'string' },
          cropType: { type: 'string' },
          areaSqKm: { type: 'number' },
          coordinates: { $ref: '#/components/schemas/Farm/properties/coordinates' },
          walletAddress: { type: 'string' },
          ndvi: { type: 'number' },
          rainfall_mm: { type: 'number' },
          status: { type: 'string', enum: ['drought', 'healthy'] },
          evaluation: { $ref: '#/components/schemas/DroughtEvaluation' },
          last_observation_date: { type: 'string', format: 'date' },
          source: { type: 'string', enum: ['real', 'hybrid', 'mock'] },
          ndvi_source: { type: 'string' },
          rainfall_source: { type: 'string' },
          observations_count: { type: 'integer' },
          provenance: {
            type: 'object',
            properties: {
              ndvi_real_days: { type: 'integer' },
              rainfall_real_days: { type: 'integer' },
              total_days: { type: 'integer' },
            },
          },
          observations: { type: 'array', items: { $ref: '#/components/schemas/DailyObservation' } },
        },
      },
      SimulationResult: {
        type: 'object',
        properties: {
          triggered: { type: 'boolean' },
          txHash: { type: ['string', 'null'] },
          explorerUrl: { type: ['string', 'null'] },
          evaluation: { $ref: '#/components/schemas/DroughtEvaluation' },
          farmId: { type: 'string' },
          farmerName: { type: 'string' },
          recipientAddress: { type: 'string' },
          method: { type: 'string', enum: ['soroban-contract', 'xlm-payment'] },
          proofHash: { type: 'string' },
        },
      },
      ContractEvent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['INIT', 'PAYOUT', 'PROOF', 'unknown'] },
          ledger: { type: 'integer' },
          closedAt: { type: 'string', format: 'date-time' },
          txHash: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
          value: {},
        },
      },
      SystemHealth: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          horizon: {
            type: 'object',
            properties: { ok: { type: 'boolean' }, url: { type: 'string' }, latencyMs: { type: 'integer' } },
          },
          sorobanRpc: {
            type: 'object',
            properties: { ok: { type: 'boolean' }, url: { type: 'string' }, latencyMs: { type: 'integer' } },
          },
          admin: {
            type: 'object',
            properties: { ok: { type: 'boolean' }, address: { type: 'string' }, xlm: { type: 'number' }, funded: { type: 'boolean' } },
          },
          contract: {
            type: 'object',
            properties: { configured: { type: 'boolean' }, id: { type: ['string', 'null'] } },
          },
          breakers: { type: 'object', additionalProperties: { type: 'object' } },
          checkedAt: { type: 'string', format: 'date-time' },
        },
      },
      PayoutEntry: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          farmId: { type: 'string' },
          farmerName: { type: 'string' },
          recipient: { type: 'string' },
          txHash: { type: 'string' },
          explorerUrl: { type: 'string' },
          method: { type: 'string' },
          proofHash: { type: 'string' },
          triggeredAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Process liveness',
        tags: ['Health'],
        responses: {
          200: { description: 'alive', content: { 'application/json': { schema: envelope({ type: 'object' }) } } },
        },
      },
    },
    '/api/health/system': {
      get: {
        summary: 'Aggregated upstream probe',
        tags: ['Health'],
        responses: {
          200: { description: 'snapshot', content: { 'application/json': { schema: envelope({ $ref: '#/components/schemas/SystemHealth' }) } } },
        },
      },
    },
    '/api/farms': {
      get: {
        summary: 'List all farms',
        tags: ['Farms'],
        responses: {
          200: { description: 'farms', content: { 'application/json': { schema: envelope({ type: 'array', items: { $ref: '#/components/schemas/Farm' } }) } } },
        },
      },
    },
    '/api/farm/{farmId}/status': {
      get: {
        summary: '14-day drought evaluation with per-day observations',
        tags: ['Farms'],
        parameters: [{ name: 'farmId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'farm status', content: { 'application/json': { schema: envelope({ $ref: '#/components/schemas/FarmStatus' }) } } },
          404: { description: 'unknown farm' },
        },
      },
    },
    '/api/farm/{farmId}/history': {
      get: {
        summary: 'Raw daily observations for a farm',
        tags: ['Farms'],
        parameters: [
          { name: 'farmId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 14, default: 14 } },
        ],
        responses: {
          200: {
            description: 'observations',
            content: {
              'application/json': {
                schema: envelope({
                  type: 'object',
                  properties: {
                    farmId: { type: 'string' },
                    observations: { type: 'array', items: { $ref: '#/components/schemas/DailyObservation' } },
                    provenance: { $ref: '#/components/schemas/FarmStatus/properties/provenance' },
                  },
                }),
              },
            },
          },
        },
      },
    },
    '/api/farm/{farmId}/simulate': {
      post: {
        summary: 'Fire a real Soroban trigger_payout tx (rate-limited)',
        tags: ['Payouts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'farmId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'payout triggered', content: { 'application/json': { schema: envelope({ $ref: '#/components/schemas/SimulationResult' }) } } },
          401: { description: 'missing/invalid Bearer token (when ADMIN_API_TOKEN is set)' },
          429: { description: 'rate-limited (10/min per IP)' },
        },
      },
    },
    '/api/payouts': {
      get: {
        summary: 'Cross-device server-side audit log',
        tags: ['Payouts'],
        parameters: [
          { name: 'farmId', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 500 } },
        ],
        responses: {
          200: { description: 'payouts', content: { 'application/json': { schema: envelope({ type: 'array', items: { $ref: '#/components/schemas/PayoutEntry' } }) } } },
        },
      },
    },
    '/api/transaction/{txHash}': {
      get: {
        summary: 'Horizon tx lookup',
        tags: ['Payouts'],
        parameters: [{ name: 'txHash', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'tx status', content: { 'application/json': { schema: envelope({ type: 'object' }) } } },
          400: { description: 'invalid hash format' },
        },
      },
    },
    '/api/contract/is-paid': {
      get: {
        summary: 'On-chain is_paid for all farms',
        tags: ['Contract'],
        responses: {
          200: {
            description: 'paid map',
            content: { 'application/json': { schema: envelope({ type: 'object', additionalProperties: { type: ['boolean', 'null'] } }) } },
          },
        },
      },
    },
    '/api/contract/is-paid/{farmId}': {
      get: {
        summary: 'On-chain is_paid for one farm',
        tags: ['Contract'],
        parameters: [{ name: 'farmId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'paid state', content: { 'application/json': { schema: envelope({ type: 'object', properties: { farmId: { type: 'string' }, isPaid: { type: 'boolean' } } }) } } },
        },
      },
    },
    '/api/contract/events': {
      get: {
        summary: 'Recent INIT/PAYOUT/PROOF events via Soroban RPC',
        tags: ['Contract'],
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 200, maximum: 500 } }],
        responses: {
          200: { description: 'events', content: { 'application/json': { schema: envelope({ type: 'array', items: { $ref: '#/components/schemas/ContractEvent' } }) } } },
        },
      },
    },
    '/api/contract/events/archive': {
      get: {
        summary: 'Long-term on-disk archive of contract events',
        description: 'Collected every 15 minutes by the server-side scheduler. Extends beyond RPC retention (~24h).',
        tags: ['Contract'],
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 1000 } }],
        responses: { 200: { description: 'archived events', content: { 'application/json': { schema: envelope({ type: 'array', items: { $ref: '#/components/schemas/ContractEvent' } }) } } } },
      },
    },
  },
};
