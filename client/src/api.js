const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  const contentType = response.headers.get("content-type");
  const data = contentType?.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(data?.message || "Something went wrong.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  getCategories() {
    return request("/categories");
  },

  getItems(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        query.set(key, value);
      }
    });

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/items${suffix}`);
  },

  getItem(id) {
    return request(`/items/${id}`);
  },

  getStats() {
    return request("/stats");
  },

  createItem(formData) {
    return request("/items", {
      method: "POST",
      body: formData,
    });
  },

  createClaim(itemId, claimData) {
    return request(`/items/${itemId}/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(claimData),
    });
  },
};

export default api;