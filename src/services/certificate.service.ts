import { execa } from 'execa';

export class CertificateService {
  async issueCertificate(domain: string) {
    try {
      // Assuming certbot is installed and we're using the nginx plugin.
      // --non-interactive and --agree-tos are important for automated systems.
      await execa('certbot', [
        'certonly',
        '--nginx',
        '-d',
        domain,
        '--non-interactive',
        '--agree-tos',
        '--register-unsafely-without-email',
      ]);
    } catch (err: any) {
      // Log or handle error if certificate issuance fails
      console.error(`Failed to issue certificate for ${domain}:`, err.stderr || err.message);
      throw err;
    }
  }
}

export const certificateService = new CertificateService();
