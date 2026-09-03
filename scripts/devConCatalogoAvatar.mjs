import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const GENERATOR = path.join(
  ROOT,
  "scripts",
  "generarCatalogoAvatar.mjs"
);
const NEXT_CLI = path.join(
  ROOT,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

function ejecutarGeneradorSilencioso() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        GENERATOR,
        "--source",
        "elementos_avatar_nuevo",
        "--quiet",
      ],
      {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        env: process.env,
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });

    child.on("exit", (code) => {
      const finalCode = code ?? 1;

      // En desarrollo no ensuciamos la terminal cuando todo esta bien.
      // Si el catalogo tiene un problema real, entonces sí mostramos todo.
      if (finalCode !== 0) {
        if (stdout.trim()) {
          process.stdout.write(stdout);
        }

        if (stderr.trim()) {
          process.stderr.write(stderr);
        }
      }

      resolve(finalCode);
    });
  });
}

if (!fs.existsSync(GENERATOR)) {
  console.error(
    `[FCC Academy] No se encontro el generador: ${GENERATOR}`
  );
  process.exit(1);
}

if (!fs.existsSync(NEXT_CLI)) {
  console.error(
    `[FCC Academy] No se encontro el CLI de Next: ${NEXT_CLI}`
  );
  process.exit(1);
}

// El catalogo se prepara una sola vez ANTES de arrancar Next.
// No existe watcher durante npm run dev.
const generatorCode =
  await ejecutarGeneradorSilencioso();

if (
  generatorCode !== 0 &&
  generatorCode !== 2
) {
  process.exit(generatorCode);
}

const next = spawn(
  process.execPath,
  [NEXT_CLI, "dev"],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    env: process.env,
  }
);

let closing = false;

function shutdown(signal) {
  if (closing) return;
  closing = true;

  if (!next.killed) {
    try {
      next.kill(signal);
    } catch {}
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

next.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

next.on("exit", (code, signal) => {
  closing = true;

  if (signal) {
    process.exit(0);
  }

  process.exit(code ?? 0);
});