const VALIDATION_SOURCES = ['body', 'query', 'params'];

export function validate(schema, source = 'body') {
  if (!VALIDATION_SOURCES.includes(source)) {
    throw new Error(`validate source must be one of: ${VALIDATION_SOURCES.join(', ')}`);
  }

  return (req, res, next) => {
    const parsed = schema.parse(req[source]);
    Object.defineProperty(req, source, {
      value: parsed,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };
}
