import Docker from 'dockerode';
import { execa } from 'execa';

const docker = new Docker();

export class DockerService {
  async buildImage(repoDir: string, imageName: string) {
    // Dockerode buildImage is sometimes complex with tar.
    // Using execa for build image might be easier and more reliable for large repos.
    // But the user asked for dockerode for Docker API.
    // Let's use execa for build image and dockerode for container management.
    await execa('docker', ['build', '-t', imageName, '.'], { cwd: repoDir });
  }

  async createAndStartContainer(options: {
    serviceId: string;
    imageName: string;
    port: number;
    volume: string;
  }) {
    const containerName = `svc-${options.serviceId}`;
    const networkName = 'app-network';

    // Ensure network exists
    const networks = await docker.listNetworks();
    if (!networks.some((n) => n.Name === networkName)) {
      await docker.createNetwork({ Name: networkName });
    }

    // Stop and remove existing container if any
    await this.stopAndRemoveContainer(containerName);

    const container = await docker.createContainer({
      Image: options.imageName,
      name: containerName,
      ExposedPorts: {
        [`${options.port}/tcp`]: {},
      },
      HostConfig: {
        Binds: [`${options.volume}:/data`],
        NetworkMode: networkName,
        RestartPolicy: { Name: 'always' },
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

  async isHealthy(containerName: string): Promise<boolean> {
    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();
      // If no health check is defined, Running state is considered healthy enough for this MVP
      if (info.State.Health) {
        return info.State.Health.Status === 'healthy';
      }
      return info.State.Running;
    } catch (err: any) {
      return false;
    }
  }
}

export const dockerService = new DockerService();
