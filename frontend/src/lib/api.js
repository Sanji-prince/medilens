import { supabase } from './supabase'

async function authHeader() {
  const { data, error } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token || error) {
    console.warn('No access token in session:', error?.message || 'no session')
    return {}
  }
  return { Authorization: `Bearer ${token}` }
}

async function request(method, path, body, attempt = 1) {
  const headers = { ...(await authHeader()) }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && attempt === 1) {
    console.warn(`401 on ${method} ${path} — refreshing session and retrying`)
    const { error } = await supabase.auth.refreshSession()
    if (!error) {
      return request(method, path, body, attempt + 1)
    }
    console.error('Session refresh failed:', error.message)
  }

  const data = await parseJSON(res)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

async function parseJSON(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  upload: async (path, formData, attempt = 1) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: await authHeader(),
      body: formData,
    })

    if (res.status === 401 && attempt === 1) {
      console.warn(`401 on POST ${path} upload — refreshing session and retrying`)
      const { error } = await supabase.auth.refreshSession()
      if (!error) {
        return api.upload(path, formData, attempt + 1)
      }
      console.error('Session refresh failed:', error.message)
    }

    const data = await parseJSON(res)
    if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`)
    return data
  },
}
