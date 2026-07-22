// Export a standard success response helper.
export function ok(res, data, message, status = 200) {
  const body = { success: true, data };

  if (message) {
    body.message = message;
  }

  return res.status(status).json(body);
}

// Export a paginated response helper.
export function paginated(res, payload, message) {
  return ok(res, payload, message);
}
