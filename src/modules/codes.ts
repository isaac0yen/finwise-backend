/**
 * Generates a random verification code of specified length
 * @param {number} length - Length of the code to generate (default: 6)
 * @returns {string} Random numeric code
 */
const generateVerificationCode = (length = 6): string => {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
};

export {
  generateVerificationCode
};