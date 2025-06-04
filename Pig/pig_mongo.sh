#!/bin/bash

set -e
set -o pipefail

INPUT_DIR="/pig/salida/accidentes"
TMP_FILE="/tmp/accidentes.json"
MONGO_URI="mongodb://mongo:27017"
DB_NAME="app1db"
COLLECTION="eventos_filtrados"
PIG_SCRIPT="/pig/scripts/analisis.pig"

echo "🚀 Iniciando el script de procesamiento..."

echo "🚀 Ejecutando script Pig: $PIG_SCRIPT"
pig -x local "$PIG_SCRIPT"
echo "✅ Script Pig ejecutado correctamente."

echo "📁 Buscando archivos en: $INPUT_DIR"
if ! ls "$INPUT_DIR"/part* 1> /dev/null 2>&1; then
  echo "❌ No se encontraron archivos de salida en $INPUT_DIR"
  exit 1
fi
echo "✅ Archivos encontrados."

echo "📦 Combinando archivos..."
cat "$INPUT_DIR"/part* > "$TMP_FILE" || {
  echo "❌ Error combinando archivos en $TMP_FILE"
  exit 1
}
echo "✅ Archivos combinados en $TMP_FILE."

echo "📄 Validando datos filtrados por Pig:"
if command -v jq > /dev/null; then
  jq '.' "$TMP_FILE" || {
    echo "❌ El archivo no es JSON válido o jq falló"
    exit 1
  }
else
  cat "$TMP_FILE"
  echo "⚠️ jq no está instalado. Mostrando JSON sin formato."
fi
echo "✅ Validación de datos completada."

echo "📤 Importando datos a MongoDB..."
if ! mongoimport --uri "$MONGO_URI" --db "$DB_NAME" --collection "$COLLECTION" --file "$TMP_FILE" --jsonArray; then
  echo "❌ Error al importar datos a MongoDB"
  exit 1
fi
echo "✅ Datos importados correctamente a $DB_NAME.$COLLECTION"

echo "🎉 Proceso finalizado con éxito."
