import Docker from "dockerode";
import { execa } from "execa";

const docker = new Docker();

export class DockerService {
  /**
   * Builds a docker image from a Dockerfile in the repository directory.
   * Ignores docker-compose files as per requirement.
   */
  async buildImage(repoDir: string, imageName: string) {
    await execa("docker", ["build", "-t", imageName, "."], {
      cwd: repoDir,
    });
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

    const binds: string[] = [];
    if (options.volume) {
      binds.push(`${options.volume}:/data`);
    }

    const container = await docker.createContainer({
      Image: options.imageName,
      name: containerName,
      ExposedPorts: exposedPorts,
      HostConfig: {
        Binds: binds,
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
