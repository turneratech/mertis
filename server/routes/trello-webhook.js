/**
 * Trello webhook handler — two-way sync from Trello card changes to Mertis bugs.
 * Trello validates the endpoint with a HEAD request before activating webhooks.
 */

const express = require('express');
const trelloSyncService = require('../services/trelloSyncService');

const router = express.Router();

router.head('/', (_req, res) => {
  res.status(200).end();
});

router.post('/', async (req, res) => {
  try {
    const result = await trelloSyncService.handleWebhookAction(req.body);
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[Trello Webhook]', err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
});

module.exports = router;
