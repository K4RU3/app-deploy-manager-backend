import { execa } from "execa";
import fs from "fs/promises";
import path from "path";

const NGINX_ROOT = "/etc/nginx";
const MANAGED_DIR = path.join(NGINX_ROOT, "managed");
const SITES_ENABLED_DIR = path.join(NGINX_ROOT, "sites-enabled");

export class NginxService {
  async generateConfig(domain: string, containerName: string, port: number) {
    const config = `
server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    location / {
        proxy_pass http://localhost:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`.trim();

    await fs.mkdir(MANAGED_DIR, { recursive: true });
    await fs.writeFile(path.join(MANAGED_DIR, `${domain}.conf`), config);
  }

  async enableService(domain: string) {
    const src = path.join(MANAGED_DIR, `${domain}.conf`);
    const dest = path.join(SITES_ENABLED_DIR, `${domain}.conf`);

    await fs.mkdir(SITES_ENABLED_DIR, { recursive: true });

    try {
      await fs.access(dest);
      // Already enabled or exists, skip
    } catch {
      await fs.symlink(src, dest);
    }

    await this.testAndReload();
  }

  async disableService(domain: string) {
    const dest = path.join(SITES_ENABLED_DIR, `${domain}.conf`);

    try {
      await fs.unlink(dest);
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }

    await this.testAndReload();
  }

  async testAndReload() {
    // await execa("nginx", ["-t"]);
    // await execa("nginx", ["-s", "reload"]);
    await execa("sudo", ["nginx", "-t"]);
    await execa("sudo", ["nginx", "-s", "reload"]);
  }
}

export const nginxService = new NginxService();
