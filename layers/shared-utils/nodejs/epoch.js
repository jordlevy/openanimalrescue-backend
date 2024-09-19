// /layers/shared-utils/epoch.js

/**
 * Generates an epoch timestamp in seconds based on the provided input.
 *
 * @param {number | Date} input - The time in milliseconds since UNIX epoch (e.g., Date.now()) or a Date object.
 * @returns {number} The epoch time in seconds.
 * @throws Will throw an error if the input is neither a number nor a valid Date object.
 *
 * @example
 * const epoch = generateEpoch(Date.now());
 * console.log(epoch); // Outputs: 1695239074
 *
 * const date = new Date();
 * const epochFromDate = generateEpoch(date);
 * console.log(epochFromDate); // Outputs: 1695239074
 */
function generateEpoch(input) {
    let timestamp;
  
    if (typeof input === 'number') {
      timestamp = input;
    } else if (input instanceof Date) {
      timestamp = input.getTime();
    } else {
      throw new Error('Invalid input type. Must be a number or Date object.');
    }
  
    if (isNaN(timestamp)) {
      throw new Error('Invalid timestamp provided. It must be a valid number representing milliseconds since UNIX epoch.');
    }
  
    return Math.floor(timestamp / 1000);
  }
  
  module.exports = { generateEpoch };
  