// Serviço de validação geográfica
// Fórmula de Haversine para calcular distância entre dois pontos GPS

const EARTH_RADIUS_METERS = 6371000;

/**
 * Converte graus para radianos.
 */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calcula a distância em metros entre dois pontos geográficos.
 * Usa a fórmula de Haversine (precisa para distâncias curtas).
 *
 * @param {number} lat1 - latitude do ponto 1
 * @param {number} lon1 - longitude do ponto 1
 * @param {number} lat2 - latitude do ponto 2
 * @param {number} lon2 - longitude do ponto 2
 * @returns {number} distância em metros
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Valida se as coordenadas do funcionário estão dentro do raio da unidade.
 *
 * @param {object} employeeCoords - { latitude, longitude } do dispositivo
 * @param {object} unit           - { latitude, longitude, radius_meters } da unidade
 * @returns {{ isInside: boolean, distanceMeters: number }}
 */
function validateZone(employeeCoords, unit) {
  const distanceMeters = haversineDistance(
    parseFloat(employeeCoords.latitude),
    parseFloat(employeeCoords.longitude),
    parseFloat(unit.latitude),
    parseFloat(unit.longitude)
  );

  return {
    isInside:       distanceMeters <= unit.radius_meters,
    distanceMeters: Math.round(distanceMeters * 10) / 10, // arredonda para 1 casa decimal
  };
}

module.exports = { haversineDistance, validateZone };
