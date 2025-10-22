import fs from "fs";
import path from "path";

const baseDir = "./public/elementos_avatar";
const recompensasDir = "./public/recompensas";
const catalogoPath = "./public/recompensas/catalogo.json";

if (!fs.existsSync(catalogoPath)) {
  console.error("❌ No se encontró public/recompensas/catalogo.json");
  process.exit(1);
}

const catalogo = JSON.parse(fs.readFileSync(catalogoPath, "utf-8"));
const rarezas = ["comun", "raro", "epico", "legendario"];
const salida = { comun: [], raro: [], epico: [], legendario: [] };

function existePreview(previewPath) {
  try {
    return fs.existsSync(path.join(".", previewPath));
  } catch {
    return false;
  }
}

for (const tipo in catalogo) {
  const items = catalogo[tipo];

  for (const [nombre, rareza] of Object.entries(items)) {
    let posiblesRutas = [];

    switch (tipo) {
      case "cabello":
        posiblesRutas = [
          `/elementos_avatar/cabello/masculino/previews/${nombre}`,
          `/elementos_avatar/cabello/femenino/previews/${nombre}`,
        ];
        break;

      case "ojos":
        posiblesRutas = [
          `/elementos_avatar/cara/ojos/masculino/previews/${nombre}`,
          `/elementos_avatar/cara/ojos/femenino/previews/${nombre}`,
          `/elementos_avatar/cara/ojos/previews/${nombre}`,
        ];
        break;

      case "boca":
        posiblesRutas = [`/elementos_avatar/cara/bocas/previews/${nombre}`];
        break;

      case "nariz":
        posiblesRutas = [`/elementos_avatar/cara/narices/previews/${nombre}`];
        break;

      case "ropa":
        posiblesRutas = [
          `/elementos_avatar/ropa/masculino/playeras/previews/${nombre}.png`,
          `/elementos_avatar/ropa/femenino/playeras/previews/${nombre}.png`,
          `/elementos_avatar/ropa/masculino/sueteres/previews/${nombre}.png`,
          `/elementos_avatar/ropa/femenino/sueteres/previews/${nombre}.png`,

          `/elementos_avatar/ropa/masculino/playeras/previews/${nombre}_Relleno.png`,
          `/elementos_avatar/ropa/femenino/playeras/previews/${nombre}_Relleno.png`,
          `/elementos_avatar/ropa/masculino/sueteres/previews/${nombre}_Relleno.png`,
          `/elementos_avatar/ropa/femenino/sueteres/previews/${nombre}_Relleno.png`,
        ];
        break;

      case "accesorios":
        posiblesRutas = [
          `/elementos_avatar/cara/lentes/previews/${nombre}`,
          `/elementos_avatar/accesorios/previews/${nombre}`,
        ];
        break;
    }

    const previewPath = posiblesRutas.find((ruta) =>
      existePreview(`public${ruta}`)
    );

    if (!previewPath) {
      console.warn(`⚠️ No se encontró preview para ${nombre} (${tipo})`);
      continue;
    }

    const baseName = nombre.replace(/\.png$/i, "");
    salida[rareza].push({
      nombre: baseName,
      tipo,
      preview: previewPath,
    });
  }
}

for (const rareza of rarezas) {
  const dir = path.join(recompensasDir, rareza);
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, "index.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(salida[rareza], null, 2),
    "utf-8"
  );
  console.log(`✅ ${rareza}: ${salida[rareza].length} recompensas registradas`);
}

console.log("\n🎉 Generación completada sin errores fatales.");
