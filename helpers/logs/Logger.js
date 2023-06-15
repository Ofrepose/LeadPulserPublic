// console styling
const chalk = require('chalk');
const envVars = require('../../envVars/index');

/**
 * Class for logging messages. Turn on inside envVars -> loggingMode
 * @class
 */
class Logger {
  constructor() {}

  /**
   * Outputs log message for informational purposes
   * @param {String} message
   * @return {Console.log} console.logs informational message
   */
  info(message) {
    try {
      if (!message) {
        const error = new Error('valid message must be provided');
        error.path = 'Logger - info';
        throw error;
      }
      if (
        envVars.loggingMode
        && envVars.extensiveLoggingMode
        && typeof message === 'string'
      ) {
        console.log(chalk.gray(message));
      } else if (envVars.loggingMode && envVars.extensiveLoggingMode) {
        console.log(chalk.gray('Object:'));
        console.log(message);
      }
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Outputs log message for warning purposes
   * @param {String} message
   * @return {Console.log} console.logs warning message
   */
  warn(message) {
    if (!message) {
      const error = new Error('valid message must be provided');
      error.path = 'Logger - warn';
      throw error;
    }
    if (envVars.loggingMode && typeof message === 'string') {
      console.log(chalk.yellow(message));
    } else {
      console.log(chalk.yellow('Object:'));
      console.log(message);
    }
  }

  /**
   * Outputs log message for error debugging purposes
   * @param {String} message
   * @return {Console.log} console.logs error message
   */
  error(message) {
    try {
      if (!message) {
        const error = new Error('valid message must be provided');
        error.path = 'Logger - warn';
        throw error;
      }
      if (envVars.loggingMode) {
        console.log(chalk.red(message));
      }
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Outputs log message for success
   * @param {String} message
   * @return {Console.log} console.logs success message
   */
  success(message, color = 'green') {
    if (!message) {
      const error = new Error('valid message must be provided');
      error.path = 'Logger - success';
      throw error;
    }
    if (
      envVars.loggingMode
      && color === 'cyan'
      && envVars.extensiveLoggingMode
    ) {
      console.log(chalk.cyan(message));
    } else if (envVars.loggingMode && color === 'green') {
      console.log(chalk.green(message));
    }
  }
}

module.exports = Logger;
