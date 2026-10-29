export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const token = sessionStorage.getItem('clarity-token');
    const response = await fetch(`/api${path}`, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    const result = await response.json();
    if (!response.ok)
        throw new Error(result.error || 'Request failed. Please try again.');
    return result;
}
export function download(name: string, content: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
