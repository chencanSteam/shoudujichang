const DEFAULT_PAGE = 'overview';

export function parseHash(hash = window.location.hash) {
  const cleanHash = hash.replace(/^#/, '').trim();
  if (!cleanHash) {
    return { page: DEFAULT_PAGE, params: new URLSearchParams() };
  }

  const normalized = cleanHash.startsWith('/') ? cleanHash.slice(1) : cleanHash;
  const [pageSegment, queryString = ''] = normalized.split('?');

  return {
    page: pageSegment || DEFAULT_PAGE,
    params: new URLSearchParams(queryString),
  };
}

export function buildHash(page, params = {}) {
  const nextParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      nextParams.set(key, value);
    }
  });

  const query = nextParams.toString();
  return `#/${page}${query ? `?${query}` : ''}`;
}

export function navigate(page, params = {}, replace = false) {
  const nextHash = buildHash(page, params);

  if (replace) {
    window.history.replaceState(null, '', nextHash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }

  window.location.hash = nextHash;
}

export function ensureRoute() {
  if (!window.location.hash) {
    navigate(DEFAULT_PAGE, {}, true);
  }
}

export function onRouteChange(handler) {
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
