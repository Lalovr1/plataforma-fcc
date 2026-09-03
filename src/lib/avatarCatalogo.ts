import { avatarCatalogoGenerado } from "@/generated/avatarCatalogo.generated";

export type GeneroAvatar = "masculino" | "femenino";

export type RarezaAvatar =
  | "inicial"
  | "comun"
  | "raro"
  | "epico"
  | "legendario";

export type AlcanceItemAvatar =
  | "global"
  | "usuario";

export type CapaSimpleAvatar = {
  image: string;
  preview: string | null;
};

export type CapaTintAvatar = {
  image: {
    fill: string;
    outline: string;
  };
  preview: {
    fill: string | null;
    outline: string | null;
  };
};

export type VarianteItemAvatar =
  | CapaSimpleAvatar
  | CapaTintAvatar;

export type OpcionImagenAvatar = {
  key: string;
  label: string;
  swatch: string | null;
  variants: Partial<
    Record<
      GeneroAvatar | "universal",
      CapaSimpleAvatar
    >
  >;
};

export type PersonalizacionAvatar =
  | {
      type: "none";
    }
  | {
      type: "tint";
      colors: string[];
    }
  | {
      type: "image_variants";
      defaultOption: string | null;
      options: OpcionImagenAvatar[];
    };

export type ItemCatalogoAvatar = {
  id: string;
  name: string;
  section: string;
  subsection: string | null;
  rarity: RarezaAvatar | null;
  scope: AlcanceItemAvatar;
  customization: PersonalizacionAvatar;
  variants: Partial<
    Record<
      GeneroAvatar | "universal",
      VarianteItemAvatar
    >
  >;
};

export type SubseccionCatalogoAvatar = {
  key: string;
  label: string;
  items: ItemCatalogoAvatar[];
};

export type SeccionColeccionAvatar = {
  key: string;
  label: string;
  type: "collection";
  items: ItemCatalogoAvatar[];
};

export type SeccionAgrupadaAvatar = {
  key: string;
  label: string;
  type: "grouped";
  subsections: SubseccionCatalogoAvatar[];
};

export type SeccionCuerpoAvatar = {
  key: "cuerpo";
  label: string;
  type: "body";
  colors: string[];
  variants: Record<
    GeneroAvatar,
    {
      image: string | null;
      fill: string | null;
      outline: string | null;
      face: string | null;
    }
  >;
};

export type SeccionEstudianteAvatar =
  | SeccionCuerpoAvatar
  | SeccionColeccionAvatar
  | SeccionAgrupadaAvatar;

export type ExpresionAvatarPersonalizado = {
  id: string;
  name: string;
  image: string;
  preview: string | null;
};

export type SeccionesPrivadasAvatar = {
  ropa: SubseccionCatalogoAvatar[];
  accesorios: SubseccionCatalogoAvatar[];
};

export type UsuarioAvatarPersonalizado = {
  email: string;
  gender: GeneroAvatar;
  body: string | null;
  expressions: ExpresionAvatarPersonalizado[];
  sections: SeccionesPrivadasAvatar;
};

export type CatalogoAvatar = {
  version: number;
  generatedAt: string;
  source: string;

  students: {
    sections: SeccionEstudianteAvatar[];
    initialRewardIds: string[];
    users: Record<
      string,
      UsuarioAvatarPersonalizado
    >;
  };

  professors: Record<
    GeneroAvatar,
    {
      sections: SeccionesPrivadasAvatar;
      users: Record<
        string,
        UsuarioAvatarPersonalizado
      >;
    }
  >;

  diagnostics: {
    warnings: string[];
    errors: string[];
  };
};

export const catalogoAvatar =
  avatarCatalogoGenerado as unknown as CatalogoAvatar;

export function obtenerSeccionesEstudianteAvatar() {
  return catalogoAvatar.students.sections;
}

export function obtenerSeccionCuerpoAvatar() {
  return (
    catalogoAvatar.students.sections.find(
      (seccion): seccion is SeccionCuerpoAvatar =>
        seccion.type === "body" &&
        seccion.key === "cuerpo"
    ) ?? null
  );
}

export function obtenerColoresPielAvatar() {
  return obtenerSeccionCuerpoAvatar()?.colors ?? [];
}

export function obtenerTodosItemsEstudianteAvatar() {
  const items: ItemCatalogoAvatar[] = [];

  for (const seccion of catalogoAvatar.students.sections) {
    if (seccion.type === "collection") {
      items.push(...seccion.items);
      continue;
    }

    if (seccion.type === "grouped") {
      for (const subseccion of seccion.subsections) {
        items.push(...subseccion.items);
      }
    }
  }

  return items;
}

export function obtenerMapaItemsEstudianteAvatar() {
  return new Map(
    obtenerTodosItemsEstudianteAvatar().map((item) => [
      item.id,
      item,
    ])
  );
}

export function obtenerItemAvatarPorId(id: string) {
  return (
    obtenerMapaItemsEstudianteAvatar().get(id) ??
    null
  );
}

export function obtenerRecompensasInicialesAvatar() {
  const ids = new Set(
    catalogoAvatar.students.initialRewardIds
  );

  return obtenerTodosItemsEstudianteAvatar().filter(
    (item) => ids.has(item.id)
  );
}

export function resolverVarianteItemAvatar(
  item: ItemCatalogoAvatar,
  genero: GeneroAvatar
) {
  return (
    item.variants[genero] ??
    item.variants.universal ??
    null
  );
}

export function resolverOpcionImagenAvatar(
  item: ItemCatalogoAvatar,
  opcionKey: string | null | undefined,
  genero: GeneroAvatar
) {
  if (
    item.customization.type !==
    "image_variants"
  ) {
    return null;
  }

  const key =
    opcionKey ??
    item.customization.defaultOption;

  const opcion =
    item.customization.options.find(
      (candidate) =>
        candidate.key === key
    ) ??
    item.customization.options[0] ??
    null;

  if (!opcion) return null;

  return {
    option: opcion,
    layer:
      opcion.variants[genero] ??
      opcion.variants.universal ??
      null,
  };
}

export function obtenerEstudiantePersonalizadoAvatar(
  email: string | null | undefined
) {
  if (!email) return null;

  return (
    catalogoAvatar.students.users[
      email.trim().toLowerCase()
    ] ?? null
  );
}

export function estudianteUsaAvatarPersonalizado(
  email: string | null | undefined
) {
  return (
    obtenerEstudiantePersonalizadoAvatar(
      email
    ) !== null
  );
}

export function obtenerProfesorAvatar(
  email: string | null | undefined
) {
  if (!email) return null;

  const normalized =
    email.trim().toLowerCase();

  return (
    catalogoAvatar.professors.masculino
      ?.users[normalized] ??
    catalogoAvatar.professors.femenino
      ?.users[normalized] ??
    null
  );
}

export function obtenerSeccionesProfesorAvatar(
  genero: GeneroAvatar
) {
  return (
    catalogoAvatar.professors[genero]
      ?.sections ?? {
      ropa: [],
      accesorios: [],
    }
  );
}

export function obtenerRopaGlobalEstudiante() {
  const ropa =
    catalogoAvatar.students.sections.find(
      (section): section is SeccionAgrupadaAvatar =>
        section.type === "grouped" &&
        section.key === "ropa"
    );

  return ropa?.subsections ?? [];
}

export function obtenerAccesoriosGlobalesEstudiante() {
  const accesorios =
    catalogoAvatar.students.sections.find(
      (section): section is SeccionAgrupadaAvatar =>
        section.type === "grouped" &&
        section.key === "accesorios"
    );

  return accesorios?.subsections ?? [];
}


function combinarSubseccionesAvatar(
  base: SubseccionCatalogoAvatar[],
  privadas: SubseccionCatalogoAvatar[]
) {
  const orden: string[] = [];
  const mapa = new Map<string, SubseccionCatalogoAvatar>();

  const agregar = (sub: SubseccionCatalogoAvatar) => {
    const existente = mapa.get(sub.key);

    if (!existente) {
      orden.push(sub.key);
      mapa.set(sub.key, {
        key: sub.key,
        label: sub.label,
        items: [...sub.items],
      });
      return;
    }

    const items = new Map(
      existente.items.map((item) => [item.id, item])
    );

    // Lo privado gana si deliberadamente reutiliza un ID global.
    for (const item of sub.items) {
      items.set(item.id, item);
    }

    mapa.set(sub.key, {
      ...existente,
      items: Array.from(items.values()),
    });
  };

  base.forEach(agregar);
  privadas.forEach(agregar);

  return orden
    .map((key) => mapa.get(key))
    .filter(
      (sub): sub is SubseccionCatalogoAvatar =>
        Boolean(sub) && sub.items.length > 0
    );
}

export function obtenerRopaEstudiantePersonalizado(
  email: string | null | undefined
) {
  const usuario = obtenerEstudiantePersonalizadoAvatar(email);
  if (!usuario) return [];

  // El cuerpo personalizado funciona como respaldo inicial. En cuanto hay
  // una prenda seleccionada deja de renderizarse, por lo que ropa/base también
  // puede usarse de forma normal en estudiantes personalizados.
  return combinarSubseccionesAvatar(
    obtenerRopaGlobalEstudiante(),
    usuario.sections.ropa
  );
}

export function obtenerAccesoriosEstudiantePersonalizado(
  email: string | null | undefined
) {
  const usuario = obtenerEstudiantePersonalizadoAvatar(email);
  if (!usuario) return [];

  return combinarSubseccionesAvatar(
    obtenerAccesoriosGlobalesEstudiante(),
    usuario.sections.accesorios
  );
}

export function obtenerItemsEstudiantePersonalizado(
  email: string | null | undefined
) {
  return [
    ...obtenerRopaEstudiantePersonalizado(email),
    ...obtenerAccesoriosEstudiantePersonalizado(email),
  ].flatMap((sub) => sub.items);
}

export function obtenerItemEstudiantePersonalizadoPorId(
  email: string | null | undefined,
  id: string
) {
  return (
    obtenerItemsEstudiantePersonalizado(email).find(
      (item) => item.id === id
    ) ?? null
  );
}

export function obtenerExpresionEstudiantePersonalizadoPorId(
  email: string | null | undefined,
  id: string | null | undefined
) {
  if (!id) return null;

  return (
    obtenerEstudiantePersonalizadoAvatar(email)
      ?.expressions.find((expresion) => expresion.id === id) ??
    null
  );
}


export function profesorUsaAvatarPersonalizado(
  email: string | null | undefined
) {
  return obtenerProfesorAvatar(email) !== null;
}

export function obtenerRopaProfesorPersonalizado(
  email: string | null | undefined
) {
  const usuario = obtenerProfesorAvatar(email);
  if (!usuario) return [];

  const globales =
    obtenerSeccionesProfesorAvatar(usuario.gender).ropa;

  return combinarSubseccionesAvatar(
    globales,
    usuario.sections.ropa
  );
}

export function obtenerAccesoriosProfesorPersonalizado(
  email: string | null | undefined
) {
  const usuario = obtenerProfesorAvatar(email);
  if (!usuario) return [];

  const globales =
    obtenerSeccionesProfesorAvatar(usuario.gender).accesorios;

  return combinarSubseccionesAvatar(
    globales,
    usuario.sections.accesorios
  );
}

export function obtenerItemsProfesorPersonalizado(
  email: string | null | undefined
) {
  return [
    ...obtenerRopaProfesorPersonalizado(email),
    ...obtenerAccesoriosProfesorPersonalizado(email),
  ].flatMap((sub) => sub.items);
}

export function obtenerItemProfesorPersonalizadoPorId(
  email: string | null | undefined,
  id: string
) {
  return (
    obtenerItemsProfesorPersonalizado(email).find(
      (item) => item.id === id
    ) ?? null
  );
}

export function obtenerExpresionProfesorPersonalizadoPorId(
  email: string | null | undefined,
  id: string | null | undefined
) {
  if (!id) return null;

  return (
    obtenerProfesorAvatar(email)
      ?.expressions.find((expresion) => expresion.id === id) ??
    null
  );
}

export function catalogoAvatarTieneErrores() {
  return (
    catalogoAvatar.diagnostics.errors.length >
    0
  );
}
