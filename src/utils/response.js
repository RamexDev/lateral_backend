/**
 * Standard API response envelope helpers.
 * See backend.md §6.0 (response envelope conventions).
 *
 * Success: { success: true, data: {...}, message?: "..." }
 * Error:   { success: false, error: { code: "MACHINE_CODE", message: "..." } }
 */

function success(res, data, message, status = 200) {
  const body = { success: true, data };
  if (message) body.message = message;
  return res.status(status).json(body);
}

function error(res, code, message, status) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

module.exports = { success, error };
