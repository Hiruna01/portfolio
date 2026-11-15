// Turns a password into the ADMIN_PASSWORD_HASH value for .env.local or Vercel.
// Run with: npm run admin:hash
// The password is read from the keyboard without being shown, and is never written to disk.

import { randomBytes, scrypt } from "node:crypto";
import { stdin, stdout } from "node:process";

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(prompt);
    let value = "";
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") process.exit(1);
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await ask("New admin password (hidden): ");
if (password.length < 12) {
  console.error("Use at least 12 characters.");
  process.exit(1);
}
if ((await ask("Type it again: ")) !== password) {
  console.error("Those did not match.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await new Promise<Buffer>((resolve, reject) =>
  scrypt(password.normalize("NFKC"), salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (err, k) => (err ? reject(err) : resolve(k))),
);
console.log("\nAdd this line to .env.local, and to the Vercel project's environment variables:\n");
console.log(`ADMIN_PASSWORD_HASH=scrypt:15:8:1:${salt.toString("base64url")}:${key.toString("base64url")}\n`);
