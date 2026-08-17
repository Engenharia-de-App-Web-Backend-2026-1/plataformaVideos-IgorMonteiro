'use strict';

class DomainError extends Error {}

class ValidationError extends DomainError {}

module.exports = { DomainError, ValidationError };
