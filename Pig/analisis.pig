-- Cargar cada línea como un campo 'event' que es un mapa
raw = LOAD 'eventos/eventos-waze.jsonl' USING JsonLoader('event:map[]');

-- Filtrar solo eventos que contienen la clave 'city'
geo = FILTER raw BY event#'city' IS NOT NULL;

-- Guardar los resultados
STORE geo INTO 'salida/geo' USING JsonStorage();
