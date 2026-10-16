/**
 * ResearchLens API Client
 * Wraps all backend endpoints with standard response shape handling.
 */

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorMsg = errJson.detail;
      }
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Domain resolution & jobs
  async suggestDomains(query) {
    if (!query || query.trim().length === 0) return [];
    const res = await request(`/domains/suggest?q=${encodeURIComponent(query.trim())}`);
    return res.data || [];
  },

  async startAnalysis(domainName) {
    const res = await request('/domains/analyze', {
      method: 'POST',
      body: JSON.stringify({ domain: domainName }),
    });
    return res.data;
  },

  async getJobStatus(jobId) {
    const res = await request(`/jobs/${jobId}`);
    return res.data;
  },

  async getDomainJob(domainId) {
    const res = await request(`/domains/${encodeURIComponent(domainId)}/job`);
    return res.data;
  },

  // Domain analytics views
  async getDomainOverview(domainId) {
    const res = await request(`/domains/${encodeURIComponent(domainId)}/overview`);
    return res;
  },

  async getDomainTrends(domainId, fromYear, toYear) {
    const params = new URLSearchParams();
    if (fromYear) params.append('from', fromYear);
    if (toYear) params.append('to', toYear);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request(`/domains/${encodeURIComponent(domainId)}/trends${qs}`);
    return res.data;
  },

  async getDomainGaps(domainId, apps) {
    const params = new URLSearchParams();
    if (apps && apps.length > 0) params.append('apps', apps.join(','));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request(`/domains/${encodeURIComponent(domainId)}/gaps${qs}`);
    return res.data;
  },

  async getDomainPapers(domainId, filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request(`/domains/${encodeURIComponent(domainId)}/papers${qs}`);
    return res.data;
  },

  async getDomainMethods(domainId) {
    const res = await request(`/domains/${encodeURIComponent(domainId)}/methods`);
    return res.data;
  },

  async getDomainChallenges(domainId) {
    const res = await request(`/domains/${encodeURIComponent(domainId)}/challenges`);
    return res.data;
  },

  async getDomainSuggestions(domainId) {
    const res = await request(`/domains/${encodeURIComponent(domainId)}/suggestions`);
    return res.data;
  },

  // Configuration
  async getApplicationsConfig() {
    const res = await request('/config/applications');
    return res.data;
  },

  // Paper details
  async getPaperDetail(paperId) {
    const res = await request(`/papers/${encodeURIComponent(paperId)}`);
    return res.data;
  },

  // Domain comparison
  async compareDomains(domain1, domain2) {
    const res = await request(`/domains/compare?d1=${encodeURIComponent(domain1)}&d2=${encodeURIComponent(domain2)}`);
    return res.data;
  },

  getJobStreamUrl(jobId) {
    return `${API_BASE}/jobs/${encodeURIComponent(jobId)}/stream`;
  },
};

