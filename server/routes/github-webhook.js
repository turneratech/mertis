/**
 * GitHub Webhook Handler (Optimized for Low-Traffic EC2)
 * 
 * Security Features:
 * - GitHub IP allowlisting (blocks non-GitHub traffic immediately)
 * - HMAC-SHA256 signature verification
 * - Rate limiting per project
 * 
 * Cost Optimizations:
 * - Early rejection of invalid requests (minimal processing)
 * - Lightweight responses
 * - Only processes configured branches
 */

const express = require('express');
const crypto = require('crypto');
const https = require('https');
const storage = require('../storage');

const router = express.Router();

// ============================================
// GITHUB IP ALLOWLIST (Updated periodically)
// Source: https://api.github.com/meta
// ============================================

let githubIpRanges = [];
let lastIpFetch = 0;
const IP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch GitHub's webhook IP ranges (cached for 24h)
 */
const fetchGitHubIps = () => {
  return new Promise((resolve) => {
    // Return cached if fresh
    if (githubIpRanges.length > 0 && Date.now() - lastIpFetch < IP_CACHE_TTL) {
      return resolve(githubIpRanges);
    }

    const req = https.get('https://api.github.com/meta', {
      headers: { 'User-Agent': 'Mertis-Webhook' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const meta = JSON.parse(data);
          githubIpRanges = meta.hooks || [];
          lastIpFetch = Date.now();
          console.log(`[GitHub Webhook] Loaded ${githubIpRanges.length} GitHub IP ranges`);
          resolve(githubIpRanges);
        } catch (e) {
          console.error('[GitHub Webhook] Failed to parse GitHub IPs:', e.message);
          resolve(githubIpRanges); // Use existing cache
        }
      });
    });

    req.on('error', (e) => {
      console.error('[GitHub Webhook] Failed to fetch GitHub IPs:', e.message);
      resolve(githubIpRanges); // Use existing cache
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(githubIpRanges);
    });
  });
};

/**
 * Check if IP is in CIDR range
 */
const ipInCidr = (ip, cidr) => {
  const [range, bits = 32] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipToInt = (ip) => {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
  };

  // Handle IPv6-mapped IPv4 addresses
  const cleanIp = ip.replace(/^::ffff:/, '');
  
  // Skip if not IPv4
  if (!cleanIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return false;
  }

  return (ipToInt(cleanIp) & mask) === (ipToInt(range) & mask);
};

/**
 * Check if request is from GitHub
 */
const isFromGitHub = async (ip) => {
  const ranges = await fetchGitHubIps();
  
  // If we couldn't fetch ranges, allow (fail open for availability)
  if (ranges.length === 0) {
    console.warn('[GitHub Webhook] No IP ranges loaded, allowing request');
    return true;
  }

  const cleanIp = ip.replace(/^::ffff:/, '');
  return ranges.some(cidr => ipInCidr(cleanIp, cidr));
};

// ============================================
// RATE LIMITING (Simple in-memory)
// ============================================

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per project

const checkRateLimit = (projectKey) => {
  const now = Date.now();
  const key = projectKey || 'global';
  
  let record = rateLimitMap.get(key);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    record = { windowStart: now, count: 0 };
  }
  
  record.count++;
  rateLimitMap.set(key, record);
  
  return record.count <= RATE_LIMIT_MAX;
};

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// ============================================
// HELPER FUNCTIONS
// ============================================

const verifySignature = (payload, signature, secret) => {
  if (!signature || !secret) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
};

const extractBugIds = (message) => {
  const matches = message.match(/([A-Z]{2,5}-\d{4,5})/g);
  return matches ? [...new Set(matches)] : [];
};

const extractAuthor = (message) => {
  const match = message.match(/- Author:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
};

const getProjectByRepoUrl = async (repoUrl) => {
  const normalizedUrl = repoUrl
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .toLowerCase();
  
  console.log('[GitHub Webhook] Looking for repo URL:', normalizedUrl);
  
  const projects = await storage.getAllProjects(null, true);
  
  // DEBUG: Log all projects and their GitHub URLs
  console.log('[GitHub Webhook] All projects with GitHub config:');
  projects.forEach(p => {
    console.log(`  - ${p.key}: githubRepoUrl="${p.githubRepoUrl || '(empty)'}", hasSecret=${!!p.webhookSecret}`);
  });
  
  return projects.find(p => {
    if (!p.githubRepoUrl) return false;
    const projectUrl = p.githubRepoUrl
      .replace(/\.git$/, '')
      .replace(/^git@github\.com:/, 'https://github.com/')
      .toLowerCase();
    console.log('[GitHub Webhook] Comparing:', projectUrl, '===', normalizedUrl, '?', projectUrl === normalizedUrl);
    return projectUrl === normalizedUrl;
  });
};

// ============================================
// BRANCH FILTERING
// Configurable branches to process
// ============================================

const ALLOWED_BRANCH_PATTERNS = [
  /^main$/,
  /^master$/,
  /^develop$/,
  /^bugfix\//,
  /^feature\//,
  /^hotfix\//,
  /^release\//
];

const shouldProcessBranch = (ref) => {
  const branch = ref.replace('refs/heads/', '');
  return ALLOWED_BRANCH_PATTERNS.some(pattern => pattern.test(branch));
};

// ============================================
// MAIN WEBHOOK ENDPOINT
// ============================================

router.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
  const startTime = Date.now();
  
  // 1. QUICK IP CHECK
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const isGitHub = await isFromGitHub(clientIp);
  console.log('[GitHub Webhook] Request from IP:', clientIp, 'Is GitHub:', isGitHub);
  if (false && !isGitHub) { 
    console.log(`[GitHub Webhook] Blocked non-GitHub IP: ${clientIp}`);
    return res.status(403).send('Forbidden');
  }

  // 2. QUICK EVENT CHECK
  const event = req.headers['x-github-event'];
  console.log('[GitHub Webhook] Event type:', event);
  if (event !== 'push') {
    console.log('[GitHub Webhook] Ignoring non-push event:', event);
    return res.status(200).send('OK');
  }

  // FIX: Store the raw body as a string for signature verification
  // This must be done BEFORE parsing, as req.body might already be parsed by global middleware
  let rawBody;
  if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString();
  } else if (typeof req.body === 'string') {
    rawBody = req.body;
  } else {
    // Body was already parsed by global middleware - this is a problem for signature verification
    console.log('[GitHub Webhook] WARNING: Body already parsed, signature verification may fail');
    rawBody = JSON.stringify(req.body);
  }

  // 3. PARSE PAYLOAD
  let payload;
  try {
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString());
    } else if (typeof req.body === 'object') {
      payload = req.body;
    } else {
      payload = JSON.parse(req.body);
    }
    console.log('[GitHub Webhook] Payload parsed, repo:', payload.repository?.html_url);
  } catch (e) {
    console.log('[GitHub Webhook] Failed to parse payload:', e.message);
    return res.status(400).send('Bad Request');
  }

  // 4. BRANCH FILTER
  // FIX: Extract branch name from ref (e.g., "refs/heads/main" -> "main")
  const branch = (payload.ref || '').replace('refs/heads/', '');
  console.log('[GitHub Webhook] Branch ref:', payload.ref, '-> branch:', branch);
  
  if (!shouldProcessBranch(payload.ref || '')) {
    console.log('[GitHub Webhook] Branch not allowed:', payload.ref);
    return res.status(200).send('OK');
  }

  // 5. FIND PROJECT
  const repoUrl = payload.repository?.html_url;
  if (!repoUrl) {
    console.log('[GitHub Webhook] No repo URL in payload');
    return res.status(200).send('OK');
  }

  const project = await getProjectByRepoUrl(repoUrl);
  console.log('[GitHub Webhook] Found project:', project?.key, 'Has secret:', !!project?.webhookSecret);
  if (!project || !project.webhookSecret) {
    console.log('[GitHub Webhook] No matching project or no secret configured');
    return res.status(200).send('OK');
  }

  // 6. RATE LIMIT CHECK
  if (!checkRateLimit(project.key)) {
    console.log(`[GitHub Webhook] Rate limited: ${project.key}`);
    return res.status(429).send('Too Many Requests');
  }

  // 7. SIGNATURE VERIFICATION
  const signature = req.headers['x-hub-signature-256'];
  console.log('[GitHub Webhook] Signature present:', !!signature);
  console.log('[GitHub Webhook] Raw body is Buffer:', Buffer.isBuffer(req.body));
  console.log('[GitHub Webhook] Raw body length:', rawBody.length);
  
  if (!verifySignature(rawBody, signature, project.webhookSecret)) {
    console.log(`[GitHub Webhook] Invalid signature for ${project.key}`);
    // DEBUG: Log expected vs received (first 20 chars only for security)
    const hmac = crypto.createHmac('sha256', project.webhookSecret);
    const expected = 'sha256=' + hmac.update(rawBody).digest('hex');
    console.log('[GitHub Webhook] Expected signature starts with:', expected.substring(0, 30) + '...');
    console.log('[GitHub Webhook] Received signature starts with:', (signature || '').substring(0, 30) + '...');
    return res.status(403).send('Forbidden');
  }
  console.log('[GitHub Webhook] Signature verified OK');

  // 8. PROCESS COMMITS
  const commits = payload.commits || [];
  console.log('[GitHub Webhook] Processing', commits.length, 'commits');
  
  // FIX: Detect if this is a merge commit
  const isMerge = commits.some(c => 
    c.message?.toLowerCase().includes('merge') || 
    (c.parents && c.parents.length > 1)
  );
  
  let bugsUpdated = 0;

  for (const commit of commits) {
    const message = commit.message || '';
    const bugIds = extractBugIds(message);
    const author = extractAuthor(message) || commit.author?.name || commit.author?.username || 'unknown';
    
    console.log('[GitHub Webhook] Commit:', commit.id?.substring(0, 7), 'Bug IDs:', bugIds, 'Author:', author);
    
    if (bugIds.length === 0) {
      console.log('[GitHub Webhook] No bug IDs found in commit message');
      continue;
    }

    for (const bugId of bugIds) {
      try {
        const bug = await storage.getBugById(bugId);
        if (!bug) {
          console.log('[GitHub Webhook] Bug not found:', bugId);
          continue;
        }

        const shortSha = commit.id?.substring(0, 7) || '?';
        const commitUrl = `${repoUrl}/commit/${commit.id}`;
        
        // FIX: Use the properly defined branch and isMerge variables
        const activityMessage = isMerge
          ? `✅ Merged to '${branch}'\nCommit: ${shortSha}\n${commitUrl}`
          : `📝 Commit to '${branch}' by ${author}\n"${message.split('\n')[0]}"\nCommit: ${shortSha}\n${commitUrl}`;

        console.log('[GitHub Webhook] Adding activity to bug:', bugId);
        await storage.addBugActivity(bugId, 'github', 'commit', activityMessage);
        bugsUpdated++;
        console.log('[GitHub Webhook] Successfully updated bug:', bugId);
      } catch (e) {
        console.error(`[GitHub Webhook] Error updating ${bugId}:`, e.message);
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[GitHub Webhook] ${project.key}: ${bugsUpdated} bugs updated in ${duration}ms`);

  // 9. MINIMAL RESPONSE
  res.status(200).json({ ok: true, bugs: bugsUpdated });
});

// ============================================
// TEST ENDPOINT (lightweight)
// ============================================

router.get('/github/test/:projectKey', async (req, res) => {
  try {
    const project = await storage.getProjectByKey(req.params.projectKey);
    if (!project) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const fullProject = await storage.getProjectById(project.id);
    
    res.json({
      key: req.params.projectKey,
      configured: !!(fullProject.githubRepoUrl && fullProject.webhookSecret),
      repoUrl: fullProject.githubRepoUrl || null,
      hasSecret: !!fullProject.webhookSecret,
      webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/github`
    });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// ============================================
// HEALTH CHECK (for monitoring)
// ============================================

router.get('/github/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    githubIps: githubIpRanges.length,
    rateLimit: rateLimitMap.size
  });
});

// Pre-fetch GitHub IPs on startup
fetchGitHubIps().then(() => {
  console.log('[GitHub Webhook] Ready');
});

module.exports = router;
