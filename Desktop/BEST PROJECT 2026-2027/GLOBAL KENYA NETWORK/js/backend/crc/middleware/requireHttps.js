
function requireHttps(req, res, next) {
  // Allow normal HTTP while developing locally.
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Express detects HTTPS using the trusted proxy configuration.
  if (req.secure) {
    return next();
  }

  const publicApiUrl = process.env.PUBLIC_API_URL;

  // Do not redirect to an unknown or user-supplied domain.
  if (!publicApiUrl) {
    return res.status(500).json({
      success: false,
      message: "HTTPS configuration is missing."
    });
  }

  try {
    const apiOrigin = new URL(publicApiUrl).origin;
    return res.redirect(308, `${apiOrigin}${req.originalUrl}`);
  } catch {
    return res.status(500).json({
      success: false,
      message: "Invalid HTTPS configuration."
    });
  }
}

module.exports = requireHttps;