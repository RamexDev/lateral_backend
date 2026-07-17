const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

function hash(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function compare(plain, hashValue) {
  return bcrypt.compare(plain, hashValue);
}

module.exports = { hash, compare };
