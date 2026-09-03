import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const QUIET = process.argv.includes("--quiet");

function info(...args) {
  if (!QUIET) {
    console.log(...args);
  }
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

const sourceName =
  argValue("--source") ||
  ((await exists(path.join(ROOT, "public", "elementos_avatar_nuevo")))
    ? "elementos_avatar_nuevo"
    : "elementos_avatar");

const sourceRoot = path.join(ROOT, "public", sourceName);
const outputPath = path.join(sourceRoot, "_catalogo.json");
const generatedDir = path.join(ROOT, "src", "generated");
const generatedTsPath = path.join(
  generatedDir,
  "avatarCatalogo.generated.ts"
);

const RARITIES = ["inicial", "comun", "raro", "epico", "legendario"];
const VARIANTS = ["masculino", "femenino", "universal"];
const SIMPLE_SECTIONS = ["cabello", "ojos"];
const GROUPED_SECTIONS = ["ropa", "accesorios"];

const warnings = [];
const errors = [];

async function dirs(target) {
  if (!(await exists(target))) return [];
  const entries = await fs.readdir(target, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith("_") &&
        entry.name !== "previews"
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "es"));
}

async function pngFiles(target) {
  if (!(await exists(target))) return [];
  const entries = await fs.readdir(target, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.startsWith("_") &&
        entry.name.toLowerCase().endsWith(".png")
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "es"));
}

function webPath(...parts) {
  return (
    "/" +
    [sourceName, ...parts]
      .map((part) => String(part).replaceAll("\\", "/"))
      .join("/")
  );
}

function titleFromKey(key) {
  return key
    .replaceAll("+", " / ")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bSueteres\b/g, "Suéteres")
    .replace(/\bUnicas\b/g, "Únicas");
}

async function readTintColors(filePath) {
  if (!(await exists(filePath))) return [];

  const raw = await fs.readFile(filePath, "utf8");
  const result = [];

  raw.split(/\r?\n/).forEach((line, index) => {
    const value = line.trim();

    if (!value || value.startsWith("//")) return;

    if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value)) {
      warnings.push(
        `Color ignorado en ${path.relative(ROOT, filePath)}:${index + 1} -> ${value}`
      );
      return;
    }

    result.push(value.toLowerCase());
  });

  return [...new Set(result)];
}

async function readImageVariantConfig(filePath) {
  if (!(await exists(filePath))) return [];

  const raw = await fs.readFile(filePath, "utf8");
  const result = [];

  raw.split(/\r?\n/).forEach((line, index) => {
    const value = line.trim();

    if (!value || value.startsWith("//")) return;

    const separator = value.indexOf("=");
    if (separator <= 0) {
      warnings.push(
        `Opcion ignorada en ${path.relative(ROOT, filePath)}:${index + 1}. Usa clave=#RRGGBB`
      );
      return;
    }

    const key = value.slice(0, separator).trim();
    const swatch = value.slice(separator + 1).trim();

    if (!key) return;

    if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(swatch)) {
      warnings.push(
        `Color de opcion ignorado en ${path.relative(ROOT, filePath)}:${index + 1} -> ${swatch}`
      );

      result.push({
        key,
        label: titleFromKey(key),
        swatch: null,
      });
      return;
    }

    result.push({
      key,
      label: titleFromKey(key),
      swatch: swatch.toLowerCase(),
    });
  });

  return result;
}

function getOrCreate(map, id, base) {
  if (!map.has(id)) {
    map.set(id, {
      ...base,
      variants: {},
    });
  }

  return map.get(id);
}

function assertCompatibleItem(item, {
  id,
  rarity,
  customizationType,
}) {
  if (item.rarity !== rarity) {
    errors.push(
      `El mismo ID aparece con rarezas diferentes: ${id} (${item.rarity} y ${rarity})`
    );
    return false;
  }

  if (item.customization.type !== customizationType) {
    errors.push(
      `El mismo ID usa dos tipos de personalizacion diferentes: ${id}`
    );
    return false;
  }

  return true;
}

async function scanNormalVariant({
  folder,
  pathParts,
  variant,
  section,
  subsection,
  rarity,
  scope,
  itemMap,
}) {
  const pngs = await pngFiles(folder);

  for (const filename of pngs) {
    const name = filename.replace(/\.png$/i, "");

    if (/_Relleno$/i.test(name) || /_Contorno$/i.test(name)) {
      warnings.push(
        `Capa _Relleno/_Contorno fuera de personalizable ignorada: ${path.relative(
          ROOT,
          path.join(folder, filename)
        )}`
      );
      continue;
    }

    const id = subsection
      ? `${section}/${subsection}/${name}`
      : `${section}/${name}`;

    const item = getOrCreate(itemMap, id, {
      id,
      name,
      section,
      subsection: subsection || null,
      rarity,
      scope,
      customization: {
        type: "none",
      },
    });

    if (
      !assertCompatibleItem(item, {
        id,
        rarity,
        customizationType: "none",
      })
    ) {
      continue;
    }

    const preview = path.join(folder, "previews", filename);

    if (!(await exists(preview))) {
      warnings.push(`Falta preview: ${path.relative(ROOT, preview)}`);
    }

    item.variants[variant] = {
      image: webPath(...pathParts, variant, filename),
      preview: (await exists(preview))
        ? webPath(...pathParts, variant, "previews", filename)
        : null,
    };
  }
}

async function scanHairImageVariant({
  folder,
  pathParts,
  variant,
  rarity,
  scope,
  configuredOptions,
  itemMap,
}) {
  const pngs = await pngFiles(folder);

  if (pngs.length === 0) {
    return;
  }

  if (configuredOptions.length === 0) {
    errors.push(
      `Cabello sin colores.txt: ${path.relative(
        ROOT,
        path.join(sourceRoot, "estudiantes", "cabello")
      )}\colores.txt. Usa Color=#RRGGBB`
    );
    return;
  }

  const opcionesPorLongitud = [...configuredOptions].sort(
    (a, b) => b.key.length - a.key.length
  );

  for (const filename of pngs) {
    const stem = filename.replace(/\.png$/i, "");
    const normalizedStem = stem.toLowerCase();

    const configured = opcionesPorLongitud.find((option) =>
      normalizedStem.endsWith(`_${option.key.toLowerCase()}`)
    );

    if (!configured) {
      errors.push(
        `Cabello no reconocido: ${path.relative(
          ROOT,
          path.join(folder, filename)
        )}. El nombre debe terminar en _<Color> declarado en estudiantes/cabello/colores.txt`
      );
      continue;
    }

    const suffixLength = configured.key.length + 1;
    const name = stem.slice(0, stem.length - suffixLength);

    if (!name) {
      errors.push(
        `Cabello sin nombre base: ${path.relative(
          ROOT,
          path.join(folder, filename)
        )}`
      );
      continue;
    }

    const id = `cabello/${name}`;

    const item = getOrCreate(itemMap, id, {
      id,
      name,
      section: "cabello",
      subsection: null,
      rarity,
      scope,
      customization: {
        type: "image_variants",
        defaultOption: null,
        options: [],
      },
    });

    if (
      !assertCompatibleItem(item, {
        id,
        rarity,
        customizationType: "image_variants",
      })
    ) {
      continue;
    }

    let option = item.customization.options.find(
      (candidate) =>
        candidate.key.toLowerCase() === configured.key.toLowerCase()
    );

    if (!option) {
      option = {
        key: configured.key,
        label: configured.label,
        swatch: configured.swatch,
        variants: {},
      };

      item.customization.options.push(option);
    }

    const preview = path.join(folder, "previews", filename);

    if (!(await exists(preview))) {
      warnings.push(
        `Falta preview de cabello: ${path.relative(ROOT, preview)}`
      );
    }

    option.variants[variant] = {
      image: webPath(...pathParts, variant, filename),
      preview: (await exists(preview))
        ? webPath(...pathParts, variant, "previews", filename)
        : null,
    };
  }
}

async function scanTintVariant({
  folder,
  pathParts,
  variant,
  section,
  subsection,
  rarity,
  scope,
  colors,
  itemMap,
}) {
  const pngs = await pngFiles(folder);
  const groups = new Map();

  for (const filename of pngs) {
    const match = filename.match(/^(.*)_(Relleno|Contorno)\.png$/i);

    if (!match) {
      warnings.push(
        `PNG no reconocido dentro de personalizable: ${path.relative(
          ROOT,
          path.join(folder, filename)
        )}`
      );
      continue;
    }

    const name = match[1];
    const kind = match[2].toLowerCase();
    const group = groups.get(name) || {};
    group[kind] = filename;
    groups.set(name, group);
  }

  for (const [name, group] of groups.entries()) {
    if (!group.relleno || !group.contorno) {
      errors.push(
        `Personalizable incompleto: ${path.relative(
          ROOT,
          folder
        )}\\${name} necesita _Relleno.png y _Contorno.png`
      );
      continue;
    }

    const id = subsection
      ? `${section}/${subsection}/${name}`
      : `${section}/${name}`;

    const item = getOrCreate(itemMap, id, {
      id,
      name,
      section,
      subsection: subsection || null,
      rarity,
      scope,
      customization: {
        type: "tint",
        colors,
      },
    });

    if (
      !assertCompatibleItem(item, {
        id,
        rarity,
        customizationType: "tint",
      })
    ) {
      continue;
    }

    const previewFill = path.join(folder, "previews", group.relleno);
    const previewOutline = path.join(folder, "previews", group.contorno);

    if (!(await exists(previewFill))) {
      warnings.push(
        `Falta preview de relleno: ${path.relative(ROOT, previewFill)}`
      );
    }

    if (!(await exists(previewOutline))) {
      warnings.push(
        `Falta preview de contorno: ${path.relative(ROOT, previewOutline)}`
      );
    }

    item.variants[variant] = {
      image: {
        fill: webPath(...pathParts, variant, group.relleno),
        outline: webPath(...pathParts, variant, group.contorno),
      },
      preview: {
        fill: (await exists(previewFill))
          ? webPath(...pathParts, variant, "previews", group.relleno)
          : null,
        outline: (await exists(previewOutline))
          ? webPath(...pathParts, variant, "previews", group.contorno)
          : null,
      },
    };
  }
}

async function scanImageVariantItemByGender({
  itemFolder,
  itemPathParts,
  itemName,
  section,
  subsection,
  rarity,
  scope,
  itemMap,
}) {
  const id = subsection
    ? `${section}/${subsection}/${itemName}`
    : `${section}/${itemName}`;

  const configPath = path.join(itemFolder, "colores.txt");
  const configuredOptions = await readImageVariantConfig(configPath);
  const configByKey = new Map(
    configuredOptions.map((option) => [
      option.key.toLowerCase(),
      option,
    ])
  );

  const optionMap = new Map();
  let pngCount = 0;

  for (const variant of VARIANTS) {
    const variantFolder = path.join(itemFolder, variant);
    const pngs = await pngFiles(variantFolder);

    for (const filename of pngs) {
      pngCount += 1;

      const fileKey = filename.replace(/\.png$/i, "");
      const normalized = fileKey.toLowerCase();
      const configured = configByKey.get(normalized);

      if (configuredOptions.length > 0 && !configured) {
        errors.push(
          `Variante no declarada en colores.txt: ${path.relative(
            ROOT,
            path.join(variantFolder, filename)
          )}. Agrega ${fileKey}=#RRGGBB en ${path.relative(ROOT, configPath)}`
        );
        continue;
      }

      const option = optionMap.get(normalized) || {
        key: configured?.key ?? fileKey,
        label: configured?.label ?? titleFromKey(fileKey),
        swatch: configured?.swatch ?? null,
        variants: {},
      };

      const preview = path.join(variantFolder, "previews", filename);

      if (!(await exists(preview))) {
        warnings.push(
          `Falta preview: ${path.relative(ROOT, preview)}`
        );
      }

      option.variants[variant] = {
        image: webPath(...itemPathParts, variant, filename),
        preview: (await exists(preview))
          ? webPath(...itemPathParts, variant, "previews", filename)
          : null,
      };

      optionMap.set(normalized, option);
    }
  }

  if (pngCount === 0) {
    return;
  }

  if (configuredOptions.length === 0 && optionMap.size > 1) {
    errors.push(
      `La prenda ${path.relative(
        ROOT,
        itemFolder
      )} tiene varias variantes PNG y necesita su propio colores.txt con formato Nombre=#RRGGBB`
    );
  }

  for (const configured of configuredOptions) {
    if (!optionMap.has(configured.key.toLowerCase())) {
      warnings.push(
        `Opcion sin PNG en ${path.relative(
          ROOT,
          configPath
        )}: ${configured.key}`
      );
    }
  }

  let options = [...optionMap.values()];

  if (configuredOptions.length > 0) {
    const order = new Map(
      configuredOptions.map((option, index) => [
        option.key.toLowerCase(),
        index,
      ])
    );

    options = options.sort((a, b) => {
      const aOrder =
        order.get(a.key.toLowerCase()) ??
        Number.MAX_SAFE_INTEGER;
      const bOrder =
        order.get(b.key.toLowerCase()) ??
        Number.MAX_SAFE_INTEGER;

      return (
        aOrder - bOrder ||
        a.key.localeCompare(b.key, "es")
      );
    });
  } else {
    options.sort((a, b) =>
      a.key.localeCompare(b.key, "es")
    );
  }

  const item = getOrCreate(itemMap, id, {
    id,
    name: itemName,
    section,
    subsection: subsection || null,
    rarity,
    scope,
    customization: {
      type: "image_variants",
      defaultOption: options[0]?.key ?? null,
      options,
    },
  });

  if (
    !assertCompatibleItem(item, {
      id,
      rarity,
      customizationType: "image_variants",
    })
  ) {
    return;
  }

  item.customization = {
    type: "image_variants",
    defaultOption: options[0]?.key ?? null,
    options,
  };
}

async function scanImageVariantItemUniversal({
  itemFolder,
  itemPathParts,
  itemName,
  section,
  subsection,
  rarity,
  scope,
  itemMap,
}) {
  const id = subsection
    ? `${section}/${subsection}/${itemName}`
    : `${section}/${itemName}`;

  const configuredOptions = await readImageVariantConfig(
    path.join(itemFolder, "colores.txt")
  );

  const configByKey = new Map(
    configuredOptions.map((option) => [
      option.key.toLowerCase(),
      option,
    ])
  );

  const pngs = await pngFiles(itemFolder);
  const options = [];

  for (const filename of pngs) {
    const key = filename.replace(/\.png$/i, "");
    const config = configByKey.get(key.toLowerCase());
    const preview = path.join(itemFolder, "previews", filename);

    if (!(await exists(preview))) {
      warnings.push(`Falta preview: ${path.relative(ROOT, preview)}`);
    }

    options.push({
      key,
      label: config?.label ?? titleFromKey(key),
      swatch: config?.swatch ?? null,
      variants: {
        universal: {
          image: webPath(...itemPathParts, filename),
          preview: (await exists(preview))
            ? webPath(...itemPathParts, "previews", filename)
            : null,
        },
      },
    });
  }

  if (configuredOptions.length > 0) {
    const order = new Map(
      configuredOptions.map((option, index) => [
        option.key.toLowerCase(),
        index,
      ])
    );

    options.sort((a, b) => {
      const aOrder = order.get(a.key.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = order.get(b.key.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;

      return (
        aOrder - bOrder ||
        a.key.localeCompare(b.key, "es")
      );
    });
  }

  if (options.length === 0) return;

  const item = getOrCreate(itemMap, id, {
    id,
    name: itemName,
    section,
    subsection: subsection || null,
    rarity,
    scope,
    customization: {
      type: "image_variants",
      defaultOption: options[0]?.key ?? null,
      options,
    },
  });

  if (
    !assertCompatibleItem(item, {
      id,
      rarity,
      customizationType: "image_variants",
    })
  ) {
    return;
  }

  item.customization = {
    type: "image_variants",
    defaultOption: options[0]?.key ?? null,
    options,
  };
}

async function scanStudentSimpleCollection(
  section,
  subsection = null
) {
  const baseParts = subsection
    ? ["estudiantes", section, subsection]
    : ["estudiantes", section];

  const baseFolder = path.join(sourceRoot, ...baseParts);
  const itemMap = new Map();

  const hairOptions =
    section === "cabello"
      ? await readImageVariantConfig(
          path.join(baseFolder, "colores.txt")
        )
      : [];

  for (const rarity of RARITIES) {
    const rarityRoot = path.join(baseFolder, rarity);

    for (const variant of VARIANTS) {
      if (section === "cabello") {
        await scanHairImageVariant({
          folder: path.join(rarityRoot, variant),
          pathParts: [...baseParts, rarity],
          variant,
          rarity,
          scope: "global",
          configuredOptions: hairOptions,
          itemMap,
        });

        continue;
      }

      await scanNormalVariant({
        folder: path.join(rarityRoot, variant),
        pathParts: [...baseParts, rarity],
        variant,
        section,
        subsection,
        rarity,
        scope: "global",
        itemMap,
      });
    }
  }

  if (section === "cabello") {
    const order = new Map(
      hairOptions.map((option, index) => [
        option.key.toLowerCase(),
        index,
      ])
    );

    for (const item of itemMap.values()) {
      if (
        item.customization.type !==
        "image_variants"
      ) {
        continue;
      }

      item.customization.options.sort((a, b) => {
        const aOrder =
          order.get(a.key.toLowerCase()) ??
          Number.MAX_SAFE_INTEGER;
        const bOrder =
          order.get(b.key.toLowerCase()) ??
          Number.MAX_SAFE_INTEGER;

        return (
          aOrder - bOrder ||
          a.key.localeCompare(b.key, "es")
        );
      });

      item.customization.defaultOption =
        item.customization.options[0]?.key ??
        null;
    }
  }

  return [...itemMap.values()].sort((a, b) =>
    a.id.localeCompare(b.id, "es")
  );
}

async function scanSimpleClothingItemsInFolder({
  root,
  pathParts,
  section,
  subsection,
  rarity,
  scope,
  itemMap,
}) {
  const simpleNames = new Set();

  for (const variant of VARIANTS) {
    const variantFolder = path.join(root, variant);
    const pngs = await pngFiles(variantFolder);

    for (const filename of pngs) {
      const name = filename.replace(/\.png$/i, "");
      const id = subsection
        ? `${section}/${subsection}/${name}`
        : `${section}/${name}`;

      const item = getOrCreate(itemMap, id, {
        id,
        name,
        section,
        subsection: subsection || null,
        rarity,
        scope,
        customization: {
          type: "none",
        },
      });

      if (
        !assertCompatibleItem(item, {
          id,
          rarity,
          customizationType: "none",
        })
      ) {
        continue;
      }

      const preview = path.join(
        variantFolder,
        "previews",
        filename
      );

      if (!(await exists(preview))) {
        warnings.push(
          `Falta preview: ${path.relative(
            ROOT,
            preview
          )}`
        );
      }

      item.variants[variant] = {
        image: webPath(...pathParts, variant, filename),
        preview: (await exists(preview))
          ? webPath(
              ...pathParts,
              variant,
              "previews",
              filename
            )
          : null,
      };

      simpleNames.add(name);
    }
  }

  return simpleNames;
}

async function scanStudentClothingSubsection(subsection) {
  if (subsection === "base") {
    errors.push(
      "La subseccion estudiantes/ropa/base ya no se usa. Coloca cada prenda dentro de su seccion real y rareza."
    );
    return [];
  }

  const baseParts = [
    "estudiantes",
    "ropa",
    subsection,
  ];
  const baseFolder = path.join(sourceRoot, ...baseParts);
  const itemMap = new Map();

  const scanColorFolders = async (
    root,
    pathParts,
    rarity,
    simpleNames
  ) => {
    const itemNames = (await dirs(root)).filter(
      (name) =>
        !VARIANTS.includes(name) &&
        name !== "personalizable" &&
        !RARITIES.includes(name)
    );

    for (const itemName of itemNames) {
      if (simpleNames.has(itemName)) {
        errors.push(
          `Nombre duplicado en ropa: ${path.relative(
            ROOT,
            root
          )}. Existe ${itemName}.png como prenda simple y tambien una carpeta ${itemName}.`
        );
        continue;
      }

      await scanImageVariantItemByGender({
        itemFolder: path.join(root, itemName),
        itemPathParts: [...pathParts, itemName],
        itemName,
        section: "ropa",
        subsection,
        rarity,
        scope: "global",
        itemMap,
      });
    }
  };

  for (const rarity of RARITIES) {
    const rarityRoot = path.join(baseFolder, rarity);

    const simpleNames =
      await scanSimpleClothingItemsInFolder({
        root: rarityRoot,
        pathParts: [...baseParts, rarity],
        section: "ropa",
        subsection,
        rarity,
        scope: "global",
        itemMap,
      });

    await scanColorFolders(
      rarityRoot,
      [...baseParts, rarity],
      rarity,
      simpleNames
    );
  }

  return [...itemMap.values()].sort((a, b) =>
    a.id.localeCompare(b.id, "es")
  );
}
async function scanBody() {
  const root = path.join(sourceRoot, "estudiantes", "cuerpo");
  const configuredColors = await readTintColors(
    path.join(root, "colores.txt")
  );
  const variants = {};
  let usesTint = false;

  for (const variant of ["masculino", "femenino"]) {
    const folder = path.join(root, variant);

    const face = path.join(folder, "Cara.png");
    const hasFace = await exists(face);

    if (!hasFace) {
      warnings.push(
        `Cuerpo ${variant}: falta Cara.png. La cara fija incluye tambien la nariz.`
      );
    }

    const fill = path.join(folder, "Relleno.png");
    const outline = path.join(folder, "Contorno.png");
    const hasFill = await exists(fill);
    const hasOutline = await exists(outline);

    if (hasFill && hasOutline) {
      usesTint = true;

      variants[variant] = {
        image: null,
        fill: webPath(
          "estudiantes",
          "cuerpo",
          variant,
          "Relleno.png"
        ),
        outline: webPath(
          "estudiantes",
          "cuerpo",
          variant,
          "Contorno.png"
        ),
        face: hasFace
          ? webPath(
              "estudiantes",
              "cuerpo",
              variant,
              "Cara.png"
            )
          : null,
      };

      continue;
    }

    if (hasFill !== hasOutline) {
      warnings.push(
        `Cuerpo ${variant}: Relleno.png y Contorno.png deben existir juntos. Se usara Cuerpo.png si existe.`
      );
    }

    const simpleBody = path.join(folder, "Cuerpo.png");
    const hasSimpleBody = await exists(simpleBody);

    if (!hasSimpleBody) {
      warnings.push(
        `Cuerpo ${variant}: falta Cuerpo.png y tampoco existe el par completo Relleno.png + Contorno.png.`
      );
    }

    variants[variant] = {
      image: hasSimpleBody
        ? webPath(
            "estudiantes",
            "cuerpo",
            variant,
            "Cuerpo.png"
          )
        : null,
      fill: null,
      outline: null,
      face: hasFace
        ? webPath(
            "estudiantes",
            "cuerpo",
            variant,
            "Cara.png"
          )
        : null,
    };
  }

  return {
    colors: usesTint ? configuredColors : [],
    variants,
  };
}

async function scanStudentSections() {
  const sections = [];

  sections.push({
    key: "cuerpo",
    label: "Cuerpo",
    type: "body",
    ...(await scanBody()),
  });

  for (const section of SIMPLE_SECTIONS) {
    const items =
      await scanStudentSimpleCollection(
        section
      );

    if (items.length === 0) continue;

    sections.push({
      key: section,
      label: titleFromKey(section),
      type: "collection",
      items,
    });
  }

  for (const section of GROUPED_SECTIONS) {
    const root = path.join(
      sourceRoot,
      "estudiantes",
      section
    );

    const subsectionNames = (await dirs(root)).filter(
      (name) =>
        name !== "personalizable" &&
        !RARITIES.includes(name) &&
        !VARIANTS.includes(name)
    );

    const subsections = [];

    for (const subsection of subsectionNames) {
      const items =
        section === "ropa"
          ? await scanStudentClothingSubsection(
              subsection
            )
          : await scanStudentSimpleCollection(
              section,
              subsection
            );

      if (items.length === 0) continue;

      subsections.push({
        key: subsection,
        label: titleFromKey(subsection),
        items,
      });
    }

    if (subsections.length === 0) continue;

    sections.push({
      key: section,
      label: titleFromKey(section),
      type: "grouped",
      subsections,
    });
  }

  return sections;
}

async function scanPrivateCollection({
  root,
  pathParts,
  section,
  subsection,
  scope,
}) {
  const itemMap = new Map();

  // Elementos normales privados/compartidos:
  // <subseccion>/Archivo.png
  // <subseccion>/previews/Archivo.png
  const normalPngs = await pngFiles(root);

  for (const filename of normalPngs) {
    const name = filename.replace(/\.png$/i, "");

    if (/_Relleno$/i.test(name) || /_Contorno$/i.test(name)) {
      warnings.push(
        `Capa _Relleno/_Contorno fuera de personalizable ignorada: ${path.relative(
          ROOT,
          path.join(root, filename)
        )}`
      );
      continue;
    }

    const id = subsection
      ? `${section}/${subsection}/${name}`
      : `${section}/${name}`;

    const preview = path.join(root, "previews", filename);

    if (!(await exists(preview))) {
      warnings.push(`Falta preview: ${path.relative(ROOT, preview)}`);
    }

    itemMap.set(id, {
      id,
      name,
      section,
      subsection: subsection || null,
      rarity: null,
      scope,
      customization: {
        type: "none",
      },
      variants: {
        universal: {
          image: webPath(...pathParts, filename),
          preview: (await exists(preview))
            ? webPath(...pathParts, "previews", filename)
            : null,
        },
      },
    });
  }

  // Personalizables por tinte privados/compartidos:
  // <subseccion>/personalizable/Nombre_Relleno.png
  // <subseccion>/personalizable/Nombre_Contorno.png
  const personalizableRoot = path.join(root, "personalizable");
  const colors = await readTintColors(
    path.join(personalizableRoot, "colores.txt")
  );
  const tintPngs = await pngFiles(personalizableRoot);
  const tintGroups = new Map();

  for (const filename of tintPngs) {
    const match = filename.match(/^(.*)_(Relleno|Contorno)\.png$/i);

    if (!match) {
      warnings.push(
        `PNG no reconocido dentro de personalizable: ${path.relative(
          ROOT,
          path.join(personalizableRoot, filename)
        )}`
      );
      continue;
    }

    const name = match[1];
    const kind = match[2].toLowerCase();
    const group = tintGroups.get(name) || {};
    group[kind] = filename;
    tintGroups.set(name, group);
  }

  for (const [name, group] of tintGroups.entries()) {
    if (!group.relleno || !group.contorno) {
      errors.push(
        `Personalizable incompleto: ${path.relative(
          ROOT,
          personalizableRoot
        )}\\${name} necesita _Relleno.png y _Contorno.png`
      );
      continue;
    }

    const id = subsection
      ? `${section}/${subsection}/${name}`
      : `${section}/${name}`;

    if (itemMap.has(id)) {
      errors.push(
        `El mismo ID existe como normal y personalizable: ${id}`
      );
      continue;
    }

    const previewFill = path.join(
      personalizableRoot,
      "previews",
      group.relleno
    );
    const previewOutline = path.join(
      personalizableRoot,
      "previews",
      group.contorno
    );

    if (!(await exists(previewFill))) {
      warnings.push(
        `Falta preview de relleno: ${path.relative(ROOT, previewFill)}`
      );
    }

    if (!(await exists(previewOutline))) {
      warnings.push(
        `Falta preview de contorno: ${path.relative(ROOT, previewOutline)}`
      );
    }

    itemMap.set(id, {
      id,
      name,
      section,
      subsection: subsection || null,
      rarity: null,
      scope,
      customization: {
        type: "tint",
        colors,
      },
      variants: {
        universal: {
          image: {
            fill: webPath(
              ...pathParts,
              "personalizable",
              group.relleno
            ),
            outline: webPath(
              ...pathParts,
              "personalizable",
              group.contorno
            ),
          },
          preview: {
            fill: (await exists(previewFill))
              ? webPath(
                  ...pathParts,
                  "personalizable",
                  "previews",
                  group.relleno
                )
              : null,
            outline: (await exists(previewOutline))
              ? webPath(
                  ...pathParts,
                  "personalizable",
                  "previews",
                  group.contorno
                )
              : null,
          },
        },
      },
    });
  }

  // Prendas/elementos que cambian el PNG completo por opcion:
  // <subseccion>/<NombreItem>/azul.png
  // <subseccion>/<NombreItem>/blanco.png
  // <subseccion>/<NombreItem>/previews/...
  const nestedItems = (await dirs(root)).filter(
    (name) =>
      name !== "personalizable" &&
      name !== "previews"
  );

  for (const itemName of nestedItems) {
    const id = subsection
      ? `${section}/${subsection}/${itemName}`
      : `${section}/${itemName}`;

    if (itemMap.has(id)) {
      errors.push(
        `El mismo ID existe como elemento normal y como variantes de imagen: ${id}`
      );
      continue;
    }

    await scanImageVariantItemUniversal({
      itemFolder: path.join(root, itemName),
      itemPathParts: [...pathParts, itemName],
      itemName,
      section,
      subsection,
      rarity: null,
      scope,
      itemMap,
    });
  }

  return [...itemMap.values()].sort((a, b) =>
    a.id.localeCompare(b.id, "es")
  );
}

async function scanPrivateSections(root, pathParts, scope) {
  const sections = {};

  for (const section of ["ropa", "accesorios"]) {
    const sectionRoot = path.join(root, section);
    const subsectionNames = await dirs(sectionRoot);
    const subsections = [];

    for (const subsection of subsectionNames) {
      const items = await scanPrivateCollection({
        root: path.join(sectionRoot, subsection),
        pathParts: [...pathParts, section, subsection],
        section,
        subsection,
        scope,
      });

      if (items.length === 0) continue;

      subsections.push({
        key: subsection,
        label: titleFromKey(subsection),
        items,
      });
    }

    sections[section] = subsections;
  }

  return sections;
}

async function scanExpressions(root, pathParts) {
  const expressionRoot = path.join(root, "expresion");
  const expressionFiles = await pngFiles(expressionRoot);
  const expressions = [];

  for (const filename of expressionFiles) {
    const preview = path.join(expressionRoot, "previews", filename);

    expressions.push({
      id: `expresion/${filename.replace(/\.png$/i, "")}`,
      name: filename.replace(/\.png$/i, ""),
      image: webPath(...pathParts, "expresion", filename),
      preview: (await exists(preview))
        ? webPath(...pathParts, "expresion", "previews", filename)
        : null,
    });
  }

  return expressions;
}

async function resolveCustomBody(userRoot, pathParts) {
  const exact = path.join(userRoot, "Cuerpo.png");

  return (await exists(exact))
    ? webPath(...pathParts, "Cuerpo.png")
    : null;
}

async function scanStudentCustomUsers() {
  const users = {};

  for (const gender of ["masculino", "femenino"]) {
    const usersRoot = path.join(
      sourceRoot,
      "estudiantes",
      "usuarios",
      gender
    );

    const emails = await dirs(usersRoot);

    for (const email of emails) {
      const userRoot = path.join(usersRoot, email);
      const userPathParts = [
        "estudiantes",
        "usuarios",
        gender,
        email,
      ];

      const body = await resolveCustomBody(
        userRoot,
        userPathParts
      );
      const expressions = await scanExpressions(
        userRoot,
        userPathParts
      );

      // Una carpeta sola no activa el avatar personalizado.
      // Se necesita Cuerpo.png y al menos una cabeza/expresion real.
      if (!body || expressions.length === 0) {
        continue;
      }

      users[email.trim().toLowerCase()] = {
        email,
        gender,
        body,
        expressions,
        sections: await scanPrivateSections(
          userRoot,
          userPathParts,
          "usuario"
        ),
      };
    }
  }

  return users;
}

async function scanProfessorSharedCollection(
  gender,
  section,
  subsection
) {
  const baseParts = [
    "profesores",
    gender,
    section,
    subsection,
  ];

  return scanPrivateCollection({
    root: path.join(sourceRoot, ...baseParts),
    pathParts: baseParts,
    section,
    subsection,
    scope: "global",
  });
}

async function scanProfessorUsers(gender) {
  const usersRoot = path.join(
    sourceRoot,
    "profesores",
    gender,
    "usuarios"
  );

  const emails = await dirs(usersRoot);
  const users = {};

  for (const email of emails) {
    const userRoot = path.join(usersRoot, email);
    const pathParts = [
      "profesores",
      gender,
      "usuarios",
      email,
    ];

    const body = await resolveCustomBody(
      userRoot,
      pathParts
    );
    const expressions = await scanExpressions(
      userRoot,
      pathParts
    );

    // Misma arquitectura que estudiantes personalizados.
    if (!body || expressions.length === 0) {
      continue;
    }

    users[email.trim().toLowerCase()] = {
      email,
      gender,
      body,
      expressions,
      sections: await scanPrivateSections(
        userRoot,
        pathParts,
        "usuario"
      ),
    };
  }

  return users;
}

async function scanProfessors() {
  const result = {};

  for (const gender of ["masculino", "femenino"]) {
    const genderRoot = path.join(
      sourceRoot,
      "profesores",
      gender
    );

    const sections = {};

    for (const section of ["ropa", "accesorios"]) {
      const root = path.join(genderRoot, section);
      const subsectionNames = await dirs(root);
      const subsections = [];

      for (const subsection of subsectionNames) {
        const items = await scanProfessorSharedCollection(
          gender,
          section,
          subsection
        );

        if (items.length === 0) continue;

        subsections.push({
          key: subsection,
          label: titleFromKey(subsection),
          items,
        });
      }

      sections[section] = subsections;
    }

    result[gender] = {
      sections,
      users: await scanProfessorUsers(gender),
    };
  }

  return result;
}

function collectInitialIds(sections) {
  const ids = [];

  for (const section of sections) {
    if (section.type === "collection") {
      for (const item of section.items) {
        if (item.rarity === "inicial") {
          ids.push(item.id);
        }
      }
    }

    if (section.type === "grouped") {
      for (const subsection of section.subsections) {
        for (const item of subsection.items) {
          if (item.rarity === "inicial") {
            ids.push(item.id);
          }
        }
      }
    }
  }

  return [...new Set(ids)].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

if (!(await exists(sourceRoot))) {
  console.error(`[FCC Academy] No existe ${sourceRoot}`);
  process.exit(1);
}

const studentSections = await scanStudentSections();

const catalogCore = {
  version: 2,
  source: sourceName,
  students: {
    sections: studentSections,
    initialRewardIds: collectInitialIds(studentSections),
    users: await scanStudentCustomUsers(),
  },
  professors: await scanProfessors(),
  diagnostics: {
    warnings,
    errors,
  },
};

async function readPreviousCatalog() {
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function withoutGeneratedAt(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const { generatedAt: _generatedAt, ...rest } = value;
  return rest;
}

const previousCatalog = await readPreviousCatalog();

const semanticChanged =
  JSON.stringify(withoutGeneratedAt(previousCatalog)) !==
  JSON.stringify(catalogCore);

let catalog;

if (semanticChanged) {
  catalog = {
    ...catalogCore,
    generatedAt: new Date().toISOString(),
  };

  const catalogJson = JSON.stringify(catalog, null, 2);

  await fs.writeFile(
    outputPath,
    catalogJson + "\n",
    "utf8"
  );

  await fs.mkdir(generatedDir, {
    recursive: true,
  });

  const generatedModule =
    `/* ARCHIVO AUTOGENERADO. NO EDITAR A MANO. */\n` +
    `/* Fuente: public/${sourceName} */\n\n` +
    `export const avatarCatalogoGenerado = ${catalogJson} as const;\n`;

  await fs.writeFile(
    generatedTsPath,
    generatedModule,
    "utf8"
  );
} else {
  catalog = previousCatalog;
}

const totalStudentItems = studentSections.reduce(
  (total, section) => {
    if (section.type === "collection") {
      return total + section.items.length;
    }

    if (section.type === "grouped") {
      return (
        total +
        section.subsections.reduce(
          (sum, subsection) =>
            sum + subsection.items.length,
          0
        )
      );
    }

    return total;
  },
  0
);

if (semanticChanged) {
  info("");
  info("[FCC Academy] Catalogo de avatar generado.");
  info(`[FCC Academy] Fuente: public/${sourceName}`);
  info(
    `[FCC Academy] Salida publica: ${path.relative(
      ROOT,
      outputPath
    )}`
  );
  info(
    `[FCC Academy] Modulo TypeScript: ${path.relative(
      ROOT,
      generatedTsPath
    )}`
  );
  info(
    `[FCC Academy] Elementos de estudiante: ${totalStudentItems}`
  );
  info(
    `[FCC Academy] Recompensas iniciales: ${catalog.students.initialRewardIds.length}`
  );
  info(
    `[FCC Academy] Estudiantes con avatar propio: ${Object.keys(
      catalog.students.users
    ).length}`
  );
  info(`[FCC Academy] Avisos: ${warnings.length}`);
  info(
    `[FCC Academy] Errores estructurales: ${errors.length}`
  );
}

if (warnings.length > 0) {
  console.log("");
  console.log("[FCC Academy] AVISOS:");

  warnings.forEach((warning) =>
    console.log(`  - ${warning}`)
  );
}

if (errors.length > 0) {
  console.log("");
  console.log("[FCC Academy] ERRORES:");

  errors.forEach((error) =>
    console.log(`  - ${error}`)
  );

  process.exitCode = 2;
}
