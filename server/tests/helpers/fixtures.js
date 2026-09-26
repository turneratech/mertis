/**
 * Shared test fixtures — IDs map to docs/VERIFICATION.md checklist rows.
 */

const INLINE_IMAGE_HTML = '<p><img src="blob:http://localhost/abc" alt="screenshot.png" data-pending-id="pending-1" class="inline-attachment-image" style="max-width:100%;height:auto;" /></p>';

const INLINE_IMAGE_SAVED_HTML = '<p><img src="" alt="screenshot.png" data-attachment-id="att-001" class="inline-attachment-image" style="max-width:100%;height:auto;" /></p>';

const DOC_LINK_HTML = '<a href="#" data-attachment-id="att-002" title="spec.pdf">spec.pdf</a>&nbsp;';

const RICH_DESCRIPTION_HTML = `<p><strong>Steps to reproduce</strong></p><ul><li>Open app</li><li>Paste image</li></ul>${INLINE_IMAGE_SAVED_HTML}`;

const XSS_SAMPLES = [
  '<script>alert(1)</script><p>safe</p>',
  '<img src=x onerror="alert(1)">',
  '<a href="javascript:alert(1)">click</a>',
  '<p onclick="alert(1)">bad</p>',
  '<iframe src="evil"></iframe><p>ok</p>'
];

const V1_COMMUNITY_PAYLOAD = {
  tier: 'community',
  maxUsers: 5,
  maxProjects: 3,
  maxBugs: 250,
  trial: false,
  features: ['basic_bug_tracking', 'project_management', 'github_integration_basic', 'export_data']
};

const V1_PROFESSIONAL_PAYLOAD = {
  tier: 'professional',
  maxUsers: null,
  maxProjects: null,
  maxBugs: null,
  trial: false
};

module.exports = {
  INLINE_IMAGE_HTML,
  INLINE_IMAGE_SAVED_HTML,
  DOC_LINK_HTML,
  RICH_DESCRIPTION_HTML,
  XSS_SAMPLES,
  V1_COMMUNITY_PAYLOAD,
  V1_PROFESSIONAL_PAYLOAD
};
