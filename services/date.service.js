/**
 * Calcula el objeto Date que representa el inicio de un día en una zona horaria específica.
 * @param {Date} date - La fecha de referencia.
 * @param {string} timeZone - La zona horaria, ej: 'America/Asuncion'.
 * @returns {Date} - Un objeto Date en UTC que representa las 00:00:00 en la zona horaria dada.
 */
export const getStartOfDayInTimezone = (date, timeZone) => {
    // Crear una nueva fecha con la misma fecha pero a las 00:00:00 en la zona horaria especificada
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Crear la fecha en la zona horaria local del sistema
    const localMidnight = new Date(year, month, day, 0, 0, 0, 0);

    // Obtener el offset de la zona horaria en minutos
    const offsetMinutes = localMidnight.getTimezoneOffset();

    // Para zonas horarias fijas como Etc/GMT+3, el offset es directo
    // Etc/GMT+3 significa UTC-3, así que offset es +180 minutos (3 horas)
    let timezoneOffset = 0;
    if (timeZone === 'Etc/GMT+3') {
        timezoneOffset = 180; // +180 minutos = UTC-3
    } else {
        // Para otras zonas horarias, usar el offset del sistema
        timezoneOffset = offsetMinutes;
    }

    // Ajustar la fecha UTC restando el offset
    const utcMidnight = new Date(localMidnight.getTime() + (timezoneOffset * 60 * 1000));

    return utcMidnight;
};
