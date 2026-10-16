export const DEFAULT_TIMEZONE = 'America/Asuncion';

/**
 * Obtiene la fecha en formato 'YYYY-MM-DD' en una zona horaria específica.
 * @param {Date} [date=new Date()] - La fecha de referencia.
 * @param {string} [timeZone=DEFAULT_TIMEZONE] - La zona horaria, ej: 'America/Asuncion'.
 * @returns {string} - La fecha en formato 'YYYY-MM-DD'.
 */
export const getDateStringInTimezone = (date = new Date(), timeZone = DEFAULT_TIMEZONE) => {
  const tz = (timeZone === 'Etc/GMT+3' || !timeZone) ? DEFAULT_TIMEZONE : timeZone;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/**
 * Calcula el objeto Date que representa el inicio de un día en una zona horaria específica.
 * @param {Date} [date=new Date()] - La fecha de referencia.
 * @param {string} [timeZone=DEFAULT_TIMEZONE] - La zona horaria, ej: 'America/Asuncion'.
 * @returns {Date} - Un objeto Date en UTC que representa las 00:00:00 en la zona horaria dada.
 */
export const getStartOfDayInTimezone = (date = new Date(), timeZone = DEFAULT_TIMEZONE) => {
  const dateStr = getDateStringInTimezone(date, timeZone);
  return new Date(`${dateStr}T00:00:00-03:00`);
};
