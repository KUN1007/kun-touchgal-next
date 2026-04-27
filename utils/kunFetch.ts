type FetchOptions = {
  headers?: Record<string, string>
  query?: Record<string, string | number>
  body?: Record<string, unknown>
  formData?: FormData
}

const kunFetchRequest = async <T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  options?: FetchOptions
): Promise<T> => {
  try {
    const { headers = {}, query, body, formData } = options || {}

    const queryString = query
      ? '?' +
        new URLSearchParams(
          Object.entries(query).map(([k, v]) => [k, String(v)])
        ).toString()
      : ''

    const fetchAddress =
      process.env.NODE_ENV === 'development'
        ? process.env.NEXT_PUBLIC_KUN_PATCH_ADDRESS_DEV
        : process.env.NEXT_PUBLIC_KUN_PATCH_ADDRESS_PROD
    const fullUrl = `${fetchAddress}/api${url}${queryString}`

    const fetchOptions: RequestInit = {
      method,
      credentials: 'include',
      mode: 'cors',
      headers: {
        'X-Requested-With': 'kun-fetch',
        ...headers
      }
    }

    if (formData) {
      fetchOptions.body = formData
    } else if (body) {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(fullUrl, fetchOptions)

    if (!response.ok) {
      throw new Error(`Kun Fetch error! Status: ${response.status}`)
    }

    const res = await response.json()

    return res
  } catch (error) {
    console.error(`Kun Fetch error: ${error}`)
    throw error
  }
}

export const kunFetchGet = async <T>(
  url: string,
  query?: Record<string, string | number>
): Promise<T> => {
  return kunFetchRequest<T>(url, 'GET', { query })
}

export const kunFetchPost = async <T>(
  url: string,
  body?: Record<string, unknown>
): Promise<T> => {
  return kunFetchRequest<T>(url, 'POST', { body })
}

export const kunFetchPut = async <T>(
  url: string,
  body?: Record<string, unknown>
): Promise<T> => {
  return kunFetchRequest<T>(url, 'PUT', { body })
}

export const kunFetchDelete = async <T>(
  url: string,
  query?: Record<string, string | number>
): Promise<T> => {
  return kunFetchRequest<T>(url, 'DELETE', { query })
}

export const kunFetchFormData = async <T>(
  url: string,
  formData?: FormData
): Promise<T> => {
  if (!formData) {
    throw new Error('formData is required for kunFetchFormData')
  }
  return kunFetchRequest<T>(url, 'POST', { formData })
}
