/**
 * @verifies VER-LIC-001 … VER-LIC-010
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { TIERS, FEATURES, TIER_FEATURES, TIER_LIMITS } = require('../../config/features');
const { getAllPlans, getPublicPlans, getIssuablePlans } = require('../../config/plans');
const { _buildStatusFromPayload, _getCommunityStatus } = require('../../services/licenseService');
const { V1_COMMUNITY_PAYLOAD, V1_PROFESSIONAL_PAYLOAD } = require('../helpers/fixtures');

describe('Tier catalog v2 [VER-LIC]', () => {
  it('VER-LIC-001: defines 8 tiers in getAllPlans()', () => {
    const ids = getAllPlans().map(p => p.id).sort();
    assert.deepEqual(ids, [
      'agency', 'business', 'cloud', 'community',
      'enterprise', 'enterprise_plus', 'professional', 'team'
    ]);
  });

  it('VER-LIC-002: Community includes EXPORT_DATA', () => {
    assert.ok(TIER_FEATURES[TIERS.COMMUNITY].includes(FEATURES.EXPORT_DATA));
  });

  it('VER-LIC-003: Community limits include maxWebhooks: 1', () => {
    assert.equal(TIER_LIMITS[TIERS.COMMUNITY].maxWebhooks, 1);
    assert.equal(_getCommunityStatus().limits.maxWebhooks, 1);
  });

  it('VER-LIC-004: Professional anti-abuse user cap is 500', () => {
    assert.equal(TIER_LIMITS[TIERS.PROFESSIONAL].maxUsers, 500);
  });

  it('VER-LIC-005: Business allows 3 instances', () => {
    assert.equal(TIER_LIMITS[TIERS.BUSINESS].maxInstances, 3);
  });

  it('VER-LIC-006: public plans are community/team/professional/business', () => {
    const publicIds = getPublicPlans().map(p => p.id).sort();
    assert.deepEqual(publicIds, ['business', 'community', 'professional', 'team']);
  });

  it('VER-LIC-007: only professional is trialTier', () => {
    const trialPlans = getAllPlans().filter(p => p.trialTier);
    assert.equal(trialPlans.length, 1);
    assert.equal(trialPlans[0].id, TIERS.PROFESSIONAL);
  });
});

describe('License status builder [VER-LIC]', () => {
  it('VER-LIC-008: v1 community JWT maps to community limits', () => {
    const status = _buildStatusFromPayload(V1_COMMUNITY_PAYLOAD);
    assert.equal(status.tier, 'community');
    assert.equal(status.limits.maxWebhooks, 1);
    assert.ok(status.features.includes(FEATURES.EXPORT_DATA));
  });

  it('VER-LIC-009: v1 professional JWT uses tier defaults', () => {
    const status = _buildStatusFromPayload(V1_PROFESSIONAL_PAYLOAD);
    assert.equal(status.tier, 'professional');
    assert.equal(status.limits.maxUsers, 500);
    assert.ok(status.features.includes(FEATURES.AI_INSIGHTS));
  });

  it('VER-LIC-010: payload limit overrides are preserved', () => {
    const status = _buildStatusFromPayload({
      tier: 'team', maxUsers: 10, maxProjects: 5, maxBugs: 100
    });
    assert.equal(status.limits.maxUsers, 10);
    assert.equal(status.limits.maxWebhooks, 3);
  });
});
