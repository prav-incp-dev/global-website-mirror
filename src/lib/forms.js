const trimFormData = (formData) =>
  Object.fromEntries(Object.entries(formData).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))

export { trimFormData }
