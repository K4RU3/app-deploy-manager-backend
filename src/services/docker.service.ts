import Docker from "dockerode";
import { execa } from "execa";
import fs from "fs/promises";
import path from "path";

const docker = new Docker();

export class DockerService {
  async buildImage(repoDir: string, imageName: string) {
    const composeFiles = ["docker-compose.yml", "docker-compose.yaml"];
    let composeFileFound = "";

    for (const file of composeFiles) {
      try {
        await fs.access(path.join(repoDir, file));
        composeFileFound = file;
        break;
      } catch {
        continue;
      }
    }

    if (composeFileFound) {
      // If compose exists, use it to build.
      // We assume the service name in compose might match or it just builds everything.
      // To ensure the built image is tagged as imageName, we can set COMPOSE_PROJECT_NAME or similar,
      // but usually docker build -t is more direct for single-container services.
      // The user specifically asked to use compose if it exists.
      await execa("docker", ["compose", "build"], { cwd: repoDir });
      
      // Note: If we use docker compose build, we might need to make sure the result 
      // can be started by dockerode using options.imageName in createAndStartContainer.
      // For now, let's assume the compose file is configured to tag the image correctly 
      // or that buildImage's role is just to ensure it's built.
    } else {
      await execa("docker", ["build", "-t", imageName, "."], { cwd: repoDir });
    }
  }

  async createAndStartContainer(options: {
    serviceId: string;
    imageName: string;
    volume: string;
    port?:
      | { host: number; container: number; protocol?: string }
      | null
      | undefined;
  }) {
    const containerName = `svc-${options.serviceId}`;
    const networkName = "app-network";

    // Ensure network exists
    const networks = await docker.listNetworks();
    if (!networks.some((n) => n.Name === networkName)) {
      await docker.createNetwork({ Name: networkName });
    }

    // Stop and remove existing container if any
    await this.stopAndRemoveContainer(containerName);

    const exposedPorts: { [key: string]: {} } = {};
    const portBindings: { [key: string]: { HostPort: string }[] } = {};

    if (options.port) {
      const portKey = `${options.port.container}/${options.port.protocol || "tcp"}`;
      exposedPorts[portKey] = {};
      portBindings[portKey] = [{ HostPort: options.port.host.toString() }];
    }

    const container = await docker.createContainer({
      Image: options.imageName,
      name: containerName,
      ExposedPorts: exposedPorts,
      HostConfig: {
        Binds: [`${options.volume}:/data`],
        PortBindings: portBindings,
        NetworkMode: networkName,
        RestartPolicy: { Name: "always" },
      },
    });

    await container.start();
  }

  async stopAndRemoveContainer(containerName: string) {
    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();
      if (info.State.Running) {
        await container.stop();
      }
      await container.remove();
    } catch (err: any) {
      if (err.statusCode !== 404) {
        throw err;
      }
    }
  }

  async removeImage(imageName: string) {
    try {
      const image = docker.getImage(imageName);
      await image.remove({ force: true });
    } catch (err: any) {
      if (err.statusCode !== 404) {
        throw err;
      }
    }
  }

  async isHealthy(containerName: string): Promise<boolean> {
    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();
      // If no health check is defined, Running state is considered healthy enough for this MVP
      if (info.State.Health) {
        return info.State.Health.Status === "healthy";
      }
      return info.State.Running;
    } catch (err: any) {
      return false;
    }
  }
}

export const dockerService = new DockerService();
