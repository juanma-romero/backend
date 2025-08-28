/**
 * Calcula el objeto Date que representa el inicio de un día en una zona horaria específica.
 * @param {Date} date - La fecha de referencia.
 * @param {string} timeZone - La zona horaria, ej: 'America/Asuncion'.
 * @returns {Date} - Un objeto Date en UTC que representa las 00:00:00 en la zona horaria dada.
 */
export const getStartOfDayInTimezone = (date, timeZone) => {
    // 1. Obtener la fecha en formato YYYY-MM-DD para la zona horaria de destino.
    const dateString = new Intl.DateTimeFormat('fr-CA', { timeZone }).format(date);

    // 2. Calcular el offset de la zona horaria de forma robusta y sin ambigüedades.
    // Se obtienen las partes de la fecha para un mismo instante en UTC y en la zona horaria de destino.
    const utcParts = new Intl.DateTimeFormat("en-US", { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, timeZone: 'UTC' }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const tzParts = new Intl.DateTimeFormat("en-US", { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, timeZone: timeZone }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

    // Se construyen dos fechas UTC a partir de las partes para calcular la diferencia en milisegundos.
    const utcDate = new Date(Date.UTC(utcParts.year, utcParts.month - 1, utcParts.day, utcParts.hour, utcParts.minute, utcParts.second));
    const tzDate = new Date(Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, tzParts.hour, tzParts.minute, tzParts.second));
    const offset = tzDate.getTime() - utcDate.getTime();

    // 3. Creamos la fecha de inicio del día en UTC (YYYY-MM-DD T00:00:00Z).
    const startOfDayUTC = new Date(dateString + 'T00:00:00.000Z');
    
    // 4. Ajustamos la hora UTC para que represente el inicio del día en la zona horaria.
    // Por ejemplo, para Asunción (UTC-3), el offset es -10800000ms.
    // Restar un número negativo equivale a sumar, por lo que a las 00:00 UTC le sumamos 3 horas,
    // dándonos las 03:00 UTC, que es exactamente la medianoche en Asunción.
    return new Date(startOfDayUTC.getTime() - offset);
};