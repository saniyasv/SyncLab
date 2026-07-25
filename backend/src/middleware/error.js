import { validationResult } from 'express-validator';

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fieldErrors = {};
    for (const e of errors.array()) {
      if (!fieldErrors[e.path]) fieldErrors[e.path] = e.msg;
    }
    return res.status(422).json({
      message: 'Validation failed',
      errors: fieldErrors,
    });
  }
  next();
}

export function notFound(_req, res) {
  res.status(404).json({ message: 'Resource not found' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error('[error]', err.stack || err.message);
  }

  res.status(status).json({ message });
}
