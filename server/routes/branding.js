const express = require('express');
const router = express.Router();
const { getOrganizationDisplayName, getOrganizationName } = require('../config/organization');

/** Public — login and footer need the customer name before auth. */
router.get('/', (req, res) => {
  res.json({
    organizationName: getOrganizationDisplayName(),
    configured: Boolean(getOrganizationName())
  });
});

module.exports = router;
