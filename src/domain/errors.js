'use strict';

class DomainError extends Error {}

class ValidationError extends DomainError {}

class NotFoundError extends DomainError {}

module.exports = { DomainError, ValidationError, NotFoundError };
